package service

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	"mdx/internal/workspace"
)

// AttachmentService 管理桌面端附件存储，以 .mdx-assets/att/ 隐藏目录作为本地附件库。
// 文件名为 {hash8}{ext}（ext 由内容嗅探得到），与 Markdown 中的 att://<hash8>.<ext> 一一对应。
// baseDir 从当前工作区自动推断，无需外部初始化。
type AttachmentService struct {
	baseDir string
}

func (s *AttachmentService) ensureBaseDir() error {
	if s.baseDir != "" {
		return nil
	}
	root := workspace.Get().Snapshot().RootPath
	if root == "" {
		return fmt.Errorf("AttachmentService not initialized: no workspace open")
	}
	attDir := filepath.Join(root, ".mdx-assets", "att")
	migrateLegacyDir(root, ".mdx-attachments", attDir)
	if err := os.MkdirAll(attDir, 0o755); err != nil {
		return fmt.Errorf("create attachment dir: %w", err)
	}
	s.baseDir = attDir
	return nil
}

// Save 将 base64 编码的附件数据存入 .mdx-assets/att/{hash}{ext}，返回 "hash.ext"。
// 如果文件已存在（相同内容哈希），直接返回键，不重复写入。
func (s *AttachmentService) Save(base64Data string) (string, error) {
	if err := s.ensureBaseDir(); err != nil {
		return "", err
	}

	data, err := decodeBase64DataURI(base64Data)
	if err != nil {
		return "", fmt.Errorf("decode base64: %w", err)
	}

	hash := hashContent(data)
	ext := extFromMime(detectMimeFromContent(data))
	key := hash + ext
	target := filepath.Join(s.baseDir, key)

	if _, err := os.Stat(target); err == nil {
		return key, nil
	}

	if err := os.WriteFile(target, data, 0o644); err != nil {
		return "", fmt.Errorf("write attachment file: %w", err)
	}
	return key, nil
}

// Load 读取附件文件并返回 base64 data-URI 字符串。
func (s *AttachmentService) Load(key string) (string, error) {
	if err := s.ensureBaseDir(); err != nil {
		return "", nil // 前端期望不存在时返回空字符串
	}

	data, err := os.ReadFile(filepath.Join(s.baseDir, key))
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", fmt.Errorf("read attachment: %w", err)
	}

	mime := detectMimeFromContent(data)
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

// Delete 删除指定键的附件文件。
func (s *AttachmentService) Delete(key string) error {
	if err := s.ensureBaseDir(); err != nil {
		return nil // 静默忽略
	}
	if err := os.Remove(filepath.Join(s.baseDir, key)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete attachment: %w", err)
	}
	return nil
}

// List 返回 .mdx-assets/att/ 下所有附件文件的键列表（"hash.ext"）。
func (s *AttachmentService) List() ([]string, error) {
	if err := s.ensureBaseDir(); err != nil {
		return nil, nil
	}

	entries, err := os.ReadDir(s.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read attachment dir: %w", err)
	}

	var keys []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		keys = append(keys, e.Name())
	}
	return keys, nil
}

// Vacuum 清理孤立附件：删除不在 activeKeys 中的文件。
func (s *AttachmentService) Vacuum(activeKeys []string) error {
	if err := s.ensureBaseDir(); err != nil {
		return nil
	}

	active := make(map[string]bool, len(activeKeys))
	for _, k := range activeKeys {
		active[k] = true
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

// AttachmentMeta 附件元数据，供前端媒体管理器展示体积/时间等。
type AttachmentMeta struct {
	Key       string `json:"key"`
	Mime      string `json:"mime"`
	Size      int64  `json:"size"`
	CreatedAt int64  `json:"createdAt"`
}

// ListMeta 返回 .mdx-assets/att/ 下所有附件的元数据（含体积与修改时间）。
func (s *AttachmentService) ListMeta() ([]AttachmentMeta, error) {
	if err := s.ensureBaseDir(); err != nil {
		return nil, nil
	}

	entries, err := os.ReadDir(s.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read attachment dir: %w", err)
	}

	var metas []AttachmentMeta
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.baseDir, e.Name()))
		mime := "application/octet-stream"
		if err == nil {
			mime = detectMimeFromContent(data)
		}
		metas = append(metas, AttachmentMeta{
			Key:       e.Name(),
			Mime:      mime,
			Size:      info.Size(),
			CreatedAt: info.ModTime().UnixMilli(),
		})
	}
	return metas, nil
}

// extFromMime 根据 MIME 类型推断文件扩展名（含点）。
func extFromMime(mime string) string {
	switch mime {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "image/svg+xml":
		return ".svg"
	case "application/pdf":
		return ".pdf"
	case "application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		return ".doc"
	case "application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		return ".xls"
	case "application/vnd.ms-powerpoint",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation":
		return ".ppt"
	case "application/zip":
		return ".zip"
	case "text/plain":
		return ".txt"
	case "text/markdown":
		return ".md"
	default:
		return ""
	}
}
