package service

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"mdx/internal/workspace"
)

// ImageService 管理桌面端图片存储，以 .mdx-images/ 隐藏目录作为本地图床。
// baseDir 从当前工作区自动推断，无需外部初始化。
type ImageService struct {
	baseDir string
}

// ensureBaseDir 从工作区状态自动设置 baseDir（懒初始化）。
// 仅当 baseDir 为空且工作区已打开时执行。
func (s *ImageService) ensureBaseDir() error {
	if s.baseDir != "" {
		return nil
	}
	root := workspace.Get().Snapshot().RootPath
	if root == "" {
		return fmt.Errorf("ImageService not initialized: no workspace open")
	}
	dir := filepath.Join(root, ".mdx-images")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create image dir: %w", err)
	}
	s.baseDir = dir
	return nil
}

// hashContent 对原始 base64 数据做 SHA-256，返回前 8 位 hex。
// 前端也会对 Blob 做同样的哈希，两边一致。
func hashContent(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])[:8]
}

// resolvePath 返回图片 hash 对应的文件路径。
func (s *ImageService) resolvePath(hash string) string {
	return filepath.Join(s.baseDir, hash)
}

// Save 将 base64 编码的图片数据存入 .mdx-images/{hash}，返回哈希值。
// 如果文件已存在（相同内容哈希），直接返回哈希，不重复写入。
func (s *ImageService) Save(base64Data string) (string, error) {
	if err := s.ensureBaseDir(); err != nil {
		return "", err
	}

	// 解析 base64 data-URI
	data, err := decodeBase64DataURI(base64Data)
	if err != nil {
		return "", fmt.Errorf("decode base64: %w", err)
	}

	hash := hashContent(data)
	target := s.resolvePath(hash)

	// 幂等：已存在则跳过写入
	if _, err := os.Stat(target); err == nil {
		return hash, nil
	}

	if err := os.WriteFile(target, data, 0o644); err != nil {
		return "", fmt.Errorf("write image file: %w", err)
	}

	return hash, nil
}

// Load 读取图片文件并返回 base64 data-URI 字符串。
func (s *ImageService) Load(hash string) (string, error) {
	if err := s.ensureBaseDir(); err != nil {
		return "", nil // 前端期望不存在时返回空字符串
	}

	data, err := os.ReadFile(s.resolvePath(hash))
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil // 前端期望不存在时返回空字符串
		}
		return "", fmt.Errorf("read image: %w", err)
	}

	mime := detectMimeFromContent(data)
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

// LoadBase64 与 Load 相同，用于复制到公众号。
func (s *ImageService) LoadBase64(hash string) (string, error) {
	return s.Load(hash)
}

// Delete 删除指定 hash 的图片文件。
func (s *ImageService) Delete(hash string) error {
	if err := s.ensureBaseDir(); err != nil {
		return nil // 静默忽略
	}
	if err := os.Remove(s.resolvePath(hash)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete image: %w", err)
	}
	return nil
}

// List 返回 .mdx-images/ 下所有图片文件的哈希列表。
func (s *ImageService) List() ([]string, error) {
	if err := s.ensureBaseDir(); err != nil {
		return nil, nil
	}

	entries, err := os.ReadDir(s.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read image dir: %w", err)
	}

	var hashes []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		hashes = append(hashes, e.Name())
	}
	return hashes, nil
}

// Vacuum 清理孤图：删除不在 activeHashes 中的文件。
func (s *ImageService) Vacuum(activeHashes []string) error {
	if err := s.ensureBaseDir(); err != nil {
		return nil
	}

	active := make(map[string]bool, len(activeHashes))
	for _, h := range activeHashes {
		active[h] = true
	}

	entries, err := os.ReadDir(s.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	for _, e := range entries {
		if e.IsDir() || active[e.Name()] {
			continue
		}
		_ = os.Remove(filepath.Join(s.baseDir, e.Name()))
	}
	return nil
}

// decodeBase64DataURI 解析 "data:image/png;base64,xxxx" 格式的字符串，返回原始字节。
func decodeBase64DataURI(uri string) ([]byte, error) {
	idx := strings.Index(uri, ",")
	if idx < 0 {
		return nil, fmt.Errorf("invalid data URI")
	}
	return base64.StdEncoding.DecodeString(uri[idx+1:])
}

// detectMimeFromContent 通过文件头部魔数检测 MIME 类型。
func detectMimeFromContent(data []byte) string {
	if len(data) < 8 {
		return "application/octet-stream"
	}
	if data[0] == 0xFF && data[1] == 0xD8 {
		return "image/jpeg"
	}
	if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return "image/png"
	}
	if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x38 {
		return "image/gif"
	}
	if data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 {
		return "image/webp"
	}
	if strings.HasPrefix(strings.ToLower(string(data[:4])), "<svg") ||
		strings.HasPrefix(strings.ToLower(string(data[:5])), "<?xml") {
		return "image/svg+xml"
	}
	return "application/octet-stream"
}
