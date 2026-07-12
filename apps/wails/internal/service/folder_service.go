package service

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"mdx/internal/util"
	"mdx/internal/workspace"
)

// FolderService exposes directory-level operations to the Wails frontend.
type FolderService struct{}

// ListFolder enumerates the immediate children of a directory as FileEntry
// items. Only .md files and directories are included. Markdown files are
// enriched with frontmatter metadata and modification time.
func (s *FolderService) ListFolder(absPath string) ([]*workspace.FileEntry, error) {
	entries, err := os.ReadDir(absPath)
	if err != nil {
		return nil, fmt.Errorf("list folder: %w", err)
	}

	result := make([]*workspace.FileEntry, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		// Skip hidden files/dirs
		if strings.HasPrefix(name, ".") {
			continue
		}

		relPath := filepath.Join(absPath, name)
		if e.IsDir() {
			result = append(result, &workspace.FileEntry{
				ID:   relPath,
				Name: name,
				Path: relPath,
				Type: workspace.Dir,
			})
		} else if strings.HasSuffix(strings.ToLower(name), ".md") {
			entry := &workspace.FileEntry{
				ID:   relPath,
				Name: name,
				Path: relPath,
				Type: workspace.File,
			}
			if info, err := e.Info(); err == nil {
				entry.UpdatedAt = info.ModTime().Format("15:04")
			}
			if data, err := os.ReadFile(relPath); err == nil {
				meta := util.ExtractFrontmatterMeta(string(data))
				entry.ThemeName = meta.ThemeName
				entry.ThemeType = meta.Theme
			}
			result = append(result, entry)
		}
	}

	// Compute file count for each directory (immediate .md children only)
	for _, entry := range result {
		if entry.Type == workspace.Dir {
			entry.FileCount = countMarkdownFiles(entry.Path)
		}
	}

	// Dirs first, then alpha by name
	sort.Slice(result, func(i, j int) bool {
		if result[i].Type != result[j].Type {
			return result[i].Type == workspace.Dir
		}
		return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name)
	})

	return result, nil
}

// countMarkdownFiles returns the number of .md files directly inside a directory.
func countMarkdownFiles(dirPath string) int {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.HasSuffix(strings.ToLower(e.Name()), ".md") {
			count++
		}
	}
	return count
}

// CreateFolder creates a directory at the given absolute path.
func (s *FolderService) CreateFolder(parentDir string, name string) (string, error) {
	target := filepath.Join(parentDir, name)
	if err := os.Mkdir(target, 0o755); err != nil {
		return "", fmt.Errorf("create folder: %w", err)
	}
	return target, nil
}

// DeleteFolder removes a directory and all its contents recursively.
func (s *FolderService) DeleteFolder(absPath string) error {
	if err := os.RemoveAll(absPath); err != nil {
		return fmt.Errorf("delete folder: %w", err)
	}
	return nil
}

// RenameFolder renames a directory within the same parent.
func (s *FolderService) RenameFolder(oldPath string, newName string) (string, error) {
	parent := filepath.Dir(oldPath)
	newPath := filepath.Join(parent, newName)
	if err := os.Rename(oldPath, newPath); err != nil {
		return "", fmt.Errorf("rename folder: %w", err)
	}
	return newPath, nil
}

// MoveFolder moves an entire directory to a new parent.
func (s *FolderService) MoveFolder(sourcePath string, targetPath string) (string, error) {
	name := filepath.Base(sourcePath)
	dest := filepath.Join(targetPath, name)
	if err := os.Rename(sourcePath, dest); err != nil {
		return "", fmt.Errorf("move folder: %w", err)
	}
	return dest, nil
}

// WalkFolder recursively collects all .md file paths under a root directory.
func (s *FolderService) WalkFolder(root string) ([]string, error) {
	var mdFiles []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			name := d.Name()
			if strings.HasPrefix(name, ".") || name == "node_modules" {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(strings.ToLower(d.Name()), ".md") {
			mdFiles = append(mdFiles, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk folder: %w", err)
	}
	sort.Strings(mdFiles)
	return mdFiles, nil
}
