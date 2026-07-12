package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"mdx/internal/util"
)

// FileService exposes file-level operations to the Wails frontend.
type FileService struct{}

// ReadResult carries the file content together with parsed frontmatter metadata.
type ReadResult struct {
	Content  string               `json:"content"`
	Meta     util.FrontmatterMeta `json:"meta"`
	FilePath string               `json:"filePath"`
}

// ReadFile reads the UTF-8 content of a file at the given absolute path.
func (s *FileService) ReadFile(absPath string) (*ReadResult, error) {
	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}
	content := string(data)
	return &ReadResult{
		Content:  content,
		Meta:     util.ExtractFrontmatterMeta(content),
		FilePath: absPath,
	}, nil
}

// WriteFile writes content to a file, creating parent directories as needed.
func (s *FileService) WriteFile(absPath string, content string) error {
	dir := filepath.Dir(absPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create parent dir: %w", err)
	}
	return os.WriteFile(absPath, []byte(content), 0o644)
}

// CreateFile creates an empty .md file. If dirPath is empty the file is
// created under the current working directory.
func (s *FileService) CreateFile(dirPath string, name string) (string, error) {
	if !strings.HasSuffix(strings.ToLower(name), ".md") {
		name += ".md"
	}
	target := filepath.Join(dirPath, name)
	if _, err := os.Stat(target); err == nil {
		return "", fmt.Errorf("file already exists: %s", name)
	}
	if err := os.WriteFile(target, []byte{}, 0o644); err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	return target, nil
}

// DeleteFile removes a file at the given absolute path.
func (s *FileService) DeleteFile(absPath string) error {
	if err := os.Remove(absPath); err != nil {
		return fmt.Errorf("delete file: %w", err)
	}
	return nil
}

// RenameFile renames a file within the same directory.
// oldPath is absolute; newName must be the new base name only.
func (s *FileService) RenameFile(oldPath string, newName string) (string, error) {
	dir := filepath.Dir(oldPath)
	newPath := filepath.Join(dir, newName)
	if err := os.Rename(oldPath, newPath); err != nil {
		return "", fmt.Errorf("rename file: %w", err)
	}
	return newPath, nil
}

// MoveFile moves a file to a different directory.
func (s *FileService) MoveFile(sourcePath string, targetDir string) (string, error) {
	name := filepath.Base(sourcePath)
	newPath := filepath.Join(targetDir, name)
	if err := os.Rename(sourcePath, newPath); err != nil {
		return "", fmt.Errorf("move file: %w", err)
	}
	return newPath, nil
}

// Exists returns true when the path exists on disk.
func (s *FileService) Exists(absPath string) bool {
	_, err := os.Stat(absPath)
	return err == nil
}
