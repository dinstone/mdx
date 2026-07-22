package util

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// UpdaterHTTPClient creates a custom *http.Client for the Wails updater.
//
// The default updater client has a 30-second timeout, no retry, and no proxy
// configuration, which makes downloading from GitHub Releases unreliable in
// networks where connections to github.com are throttled or reset (e.g. behind
// the GFW).
//
// This client:
//   - Has no client-level timeout (the updater's context controls cancellation).
//   - Reads proxy from HTTPS_PROXY / HTTP_PROXY environment variables so users
//     can bypass network interference by setting a proxy.
//   - Retries failed connection attempts up to 5 times with backoff.
//   - Supports resumable downloads via HTTP Range headers when a mid-download
//     connection reset occurs (the most common failure mode behind the GFW).
func UpdaterHTTPClient() *http.Client {
	transport := &resumableTransport{
		base: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
		},
		maxRetry: 5,
	}
	return &http.Client{
		Timeout:   0, // no client-level timeout; rely on context
		Transport: transport,
	}
}

// resumableTransport wraps an http.RoundTripper to add retry-on-connect and
// resumable-download capabilities.
type resumableTransport struct {
	base     http.RoundTripper
	maxRetry int
}

func (t *resumableTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	var lastErr error
	for attempt := 0; attempt <= t.maxRetry; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(attempt*2) * time.Second
			log.Printf("[updater] retrying connection (attempt %d/%d) after %v", attempt, t.maxRetry, backoff)
			time.Sleep(backoff)
		}

		resp, err := t.base.RoundTrip(req)
		if err != nil {
			lastErr = err
			log.Printf("[updater] connection attempt %d failed: %v", attempt+1, err)
			continue
		}

		// Wrap GET response bodies to support resumable reads on mid-stream errors.
		if req.Method == http.MethodGet {
			resp.Body = &resumableBody{
				transport: t,
				req:       req.Clone(context.Background()),
				body:      resp.Body,
				offset:    0,
			}
		}
		return resp, nil
	}
	return nil, fmt.Errorf("updater: after %d attempts: %w", t.maxRetry+1, lastErr)
}

// resumableBody wraps an http.Response.Body to resume downloads when a read
// error occurs mid-stream, using HTTP Range headers.
type resumableBody struct {
	transport *resumableTransport
	req       *http.Request
	body      io.ReadCloser
	offset    int64
}

func (b *resumableBody) Read(p []byte) (int, error) {
	for {
		n, err := b.body.Read(p)
		b.offset += int64(n)

		if err == nil || err == io.EOF {
			return n, err
		}

		// Mid-stream read error (e.g. connection reset by peer) — attempt to resume.
		log.Printf("[updater] download interrupted at offset %d: %v", b.offset, err)
		b.body.Close()

		resumed := false
		for retry := 0; retry < b.transport.maxRetry; retry++ {
			backoff := time.Duration(retry+1) * 2 * time.Second
			log.Printf("[updater] resuming from offset %d (retry %d/%d) after %v",
				b.offset, retry+1, b.transport.maxRetry, backoff)
			time.Sleep(backoff)

			resp, retryErr := b.resumeRequest()
			if retryErr != nil {
				log.Printf("[updater] resume attempt %d failed: %v", retry+1, retryErr)
				continue
			}

			switch resp.StatusCode {
			case http.StatusPartialContent:
				// Server supports Range — resume from where we left off.
				b.body = resp.Body
				resumed = true
				log.Printf("[updater] resume succeeded from offset %d", b.offset)
			case http.StatusOK:
				// Server doesn't support Range — restart from beginning.
				b.body = resp.Body
				b.offset = 0
				resumed = true
				log.Printf("[updater] server doesn't support Range, restarting from beginning")
			default:
				resp.Body.Close()
				log.Printf("[updater] resume attempt %d: unexpected HTTP %d", retry+1, resp.StatusCode)
			}

			if resumed {
				break
			}
		}

		if !resumed {
			return n, fmt.Errorf("updater: download failed at offset %d and resume failed: %w", b.offset, err)
		}

		// If we got some data before the error, return it now.
		// The next Read call will read from the resumed body.
		if n > 0 {
			return n, nil
		}
		// No data yet — loop and read from the resumed body.
	}
}

// resumeRequest creates a new HTTP request with a Range header to resume the
// download from the current offset. It uses a client that follows redirects
// and strips Authorization headers on cross-domain redirects (matching the
// GitHub provider's followAndStrip behaviour).
func (b *resumableBody) resumeRequest() (*http.Response, error) {
	client := &http.Client{
		Transport: b.transport.base,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) > 0 && !strings.EqualFold(via[len(via)-1].URL.Host, req.URL.Host) {
				req.Header.Del("Authorization")
			}
			if len(via) >= 10 {
				return fmt.Errorf("stopped after 10 redirects")
			}
			return nil
		},
	}

	newReq := b.req.Clone(context.Background())
	newReq.Header.Set("Range", fmt.Sprintf("bytes=%d-", b.offset))

	return client.Do(newReq)
}

func (b *resumableBody) Close() error {
	return b.body.Close()
}
