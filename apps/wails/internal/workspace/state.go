package workspace

import (
	"path/filepath"
	"sync"
)

// FileType classifies a workspace entry.
type FileType string

const (
	File FileType = "file"
	Dir  FileType = "dir"
)

// FileEntry represents a file or directory in the workspace tree.
type FileEntry struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Path      string       `json:"path"` // relative to workspace root
	Type      FileType     `json:"type"`
	Children  []*FileEntry `json:"children,omitempty"`
	UpdatedAt string       `json:"updatedAt,omitempty"`
	ThemeName string       `json:"themeName,omitempty"`
	ThemeType string       `json:"themeType,omitempty"`
	FileCount int          `json:"fileCount,omitempty"`
}

// State holds the current workspace session.
type State struct {
	mu           sync.RWMutex
	RootPath     string       `json:"rootPath"`
	Title        string       `json:"title"`
	Entries      []*FileEntry `json:"entries"`
	ActiveFileID string       `json:"activeFileId"`
}

var current = &State{}

// Get returns the singleton workspace state.
func Get() *State { return current }

// SetRoot replaces the workspace root path and derived title.
func (s *State) SetRoot(path string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.RootPath = path
	s.Title = filepath.Base(path)
	s.Entries = nil
	s.ActiveFileID = ""
}

// Clear resets the workspace state.
func (s *State) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.RootPath = ""
	s.Title = ""
	s.Entries = nil
	s.ActiveFileID = ""
}

// SetEntries replaces the file tree.
func (s *State) SetEntries(entries []*FileEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Entries = entries
}

// SetActiveFile sets the currently active file ID.
func (s *State) SetActiveFile(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ActiveFileID = id
}

// Snapshot returns a safe copy of the public state for serialization.
func (s *State) Snapshot() *State {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cp := &State{
		RootPath:     s.RootPath,
		Title:        s.Title,
		Entries:      s.Entries,
		ActiveFileID: s.ActiveFileID,
	}
	return cp
}
