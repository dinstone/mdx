package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/updater"
)

// appRef and updaterRef bridge the running application into this service so it
// can drive background update checks and push results to the frontend. They are
// populated by main.go right after the application and updater are initialised.
var (
	appRef     *application.App
	updaterRef *updater.Updater

	autoMu      sync.Mutex
	autoStarted bool
)

// SetApp wires the running application into the update service.
func SetApp(app *application.App) { appRef = app }

// SetUpdater wires the application's Updater into the update service.
func SetUpdater(u *updater.Updater) { updaterRef = u }

// UpdateService drives background update checks and surfaces availability to
// the frontend. The actual download/install is performed by the Wails3 Updater
// (owned by main.go and handed in via SetUpdater).
type UpdateService struct{}

// CheckUpdateResult carries the latest version info to the frontend.
type CheckUpdateResult struct {
	HasUpdate bool   `json:"hasUpdate"`
	Version   string `json:"version"`
	Name      string `json:"name"`
	Notes     string `json:"notes"`
	URL       string `json:"url"`
}

// lastCheck caches the most recent background-check result so the frontend can
// fetch it on demand (e.g. right after the "updater:available" event, or as a
// fallback if that push event was missed for any reason).
var (
	lastCheckMu sync.Mutex
	lastCheck   *CheckUpdateResult
)

func cacheResult(r *CheckUpdateResult) {
	lastCheckMu.Lock()
	lastCheck = r
	lastCheckMu.Unlock()
}

func getCachedResult() *CheckUpdateResult {
	lastCheckMu.Lock()
	defer lastCheckMu.Unlock()
	return lastCheck
}

// StartAutoCheck kicks off a one-shot background update check a few seconds
// after launch, so it never competes with startup and the frontend has time to
// mount and register its "updater:available" listener before we emit.
//
// It is idempotent — repeated calls (e.g. from a re-entrant mount) are ignored.
//
// On a newer release being found it emits an "updater:available" event for the
// frontend to surface a notification; network/parse errors are swallowed
// because a background check should fail silently. Dev builds pinned to
// version "0.0.0" are skipped to avoid false-positive "update available" nags.
func (s *UpdateService) StartAutoCheck() {
	autoMu.Lock()
	if autoStarted {
		autoMu.Unlock()
		return
	}
	autoStarted = true
	autoMu.Unlock()

	if AppVersion() == "0.0.0" {
		log.Printf("[updater] auto-check skipped in dev build (version 0.0.0)")
		return
	}

	go func() {
		// Give the app time to settle and the frontend time to register its
		// listener before we push the availability event.
		time.Sleep(3 * time.Second)
		s.checkNow(true)
	}()
}

// checkNow performs a synchronous check. When emit is true and a newer release
// is found, it pushes the "updater:available" event to the frontend.
func (s *UpdateService) checkNow(emit bool) {
	if updaterRef == nil {
		log.Printf("[updater] check skipped: updater not initialised")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	rel, err := updaterRef.Check(ctx)
	if err != nil {
		log.Printf("[updater] check failed: %v", err)
		return
	}
	if rel == nil {
		log.Printf("[updater] up to date (current %s)", AppVersion())
		cacheResult(&CheckUpdateResult{HasUpdate: false})
		return
	}

	result := &CheckUpdateResult{
		HasUpdate: true,
		Version:   rel.Version,
		Name:      rel.Name,
		Notes:     rel.Notes,
		URL:       releaseURL(rel),
	}
	cacheResult(result)
	log.Printf("[updater] update available: %s", rel.Version)

	if emit && appRef != nil {
		appRef.Event.Emit("updater:available", rel.Version)
	}
}

// GetLastUpdate returns the cached result of the most recent background check,
// running a fresh check first if none has completed yet. Used by the frontend
// as a fallback fetch right after the "updater:available" event.
func (s *UpdateService) GetLastUpdate() *CheckUpdateResult {
	if getCachedResult() == nil {
		s.checkNow(false)
	}
	return getCachedResult()
}

// InstallUpdate runs a full check + download + install. Used by the "立即更新"
// button in the notification and by the Help menu.
func (s *UpdateService) InstallUpdate() error {
	if updaterRef == nil {
		return fmt.Errorf("updater not initialised")
	}
	return updaterRef.CheckAndInstall(context.Background())
}

// releaseURL builds a best-effort release page URL from the release metadata.
func releaseURL(rel *updater.Release) string {
	if rel == nil {
		return ""
	}
	if u, ok := rel.Metadata["html_url"].(string); ok && u != "" {
		return u
	}
	return ""
}
