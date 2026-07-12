package service

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"

	"mdx/internal/workspace"
)

// WorkspaceService manages the workspace lifecycle: open, close, and query
// state. The frontend calls these methods to bind the editor to a working
// directory.
type WorkspaceService struct{}

// Open initialises the workspace with the given root directory path.  It
// validates that the directory exists and populates the file tree.
func (s *WorkspaceService) Open(dirPath string) (*workspace.State, error) {
	info, err := os.Stat(dirPath)
	if err != nil {
		return nil, fmt.Errorf("open workspace: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("not a directory: %s", dirPath)
	}

	abs, err := filepath.Abs(dirPath)
	if err != nil {
		return nil, fmt.Errorf("resolve path: %w", err)
	}

	state := workspace.Get()
	state.SetRoot(abs)

	// Build initial tree from root level
	var folderSvc FolderService
	entries, err := folderSvc.ListFolder(abs)
	if err != nil {
		// Non-fatal — opening succeeds but tree is empty.
		entries = nil
	}
	state.SetEntries(entries)

	return state.Snapshot(), nil
}

// PickAndOpen shows a native folder picker, opens the selected directory as a
// workspace, and notifies the frontend via a custom event.
func (s *WorkspaceService) PickAndOpen() (*workspace.State, error) {
	result, err := application.Get().Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		SetTitle("Open Workspace Folder").
		PromptForSingleSelection()
	if err != nil {
		return nil, fmt.Errorf("pick folder: %w", err)
	}
	if result == "" {
		return nil, fmt.Errorf("no folder selected")
	}

	state, err := s.Open(result)
	if err != nil {
		return nil, err
	}
	application.Get().Event.Emit("workspace:opened", state.RootPath)
	return state, nil
}

// Close tears down the workspace and clears all state.
func (s *WorkspaceService) Close() error {
	workspace.Get().Clear()
	application.Get().Event.Emit("workspace:closed", "")
	return nil
}

// GetState returns a snapshot of the current workspace state.
func (s *WorkspaceService) GetState() *workspace.State {
	return workspace.Get().Snapshot()
}

// SetActiveFile marks the given file (absolute path) as the active document.
func (s *WorkspaceService) SetActiveFile(absPath string) error {
	workspace.Get().SetActiveFile(absPath)
	return nil
}

// ResolvePath joins the workspace root with a relative path.
func (s *WorkspaceService) ResolvePath(relative string) (string, error) {
	root := workspace.Get().Snapshot().RootPath
	if root == "" {
		return "", fmt.Errorf("no workspace open")
	}
	return filepath.Join(root, relative), nil
}
