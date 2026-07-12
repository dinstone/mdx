package service

import (
	"fmt"
	"os/exec"
	"runtime"
)

const appVersion = "0.0.1"

// SystemService exposes OS-level helpers: platform info, external links,
// and file-manager reveal.
type SystemService struct{}

// PlatformInfo bundles OS details.
type PlatformInfo struct {
	OS      string `json:"os"`
	Arch    string `json:"arch"`
	Version string `json:"version"`
}

// GetPlatform returns the operating system and architecture.
func (s *SystemService) GetPlatform() *PlatformInfo {
	return &PlatformInfo{
		OS:      runtime.GOOS,
		Arch:    runtime.GOARCH,
		Version: appVersion,
	}
}

// GetAppVersion returns the application version string.
func (s *SystemService) GetAppVersion() string {
	return appVersion
}

// OpenExternal opens a URL in the default system browser.
func (s *SystemService) OpenExternal(url string) error {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
		args = []string{url}
	case "linux":
		cmd = "xdg-open"
		args = []string{url}
	case "windows":
		cmd = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", url}
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
	return exec.Command(cmd, args...).Start()
}

// ShowItemInFolder reveals the file at absPath in the system file manager.
func (s *SystemService) ShowItemInFolder(absPath string) error {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
		args = []string{"-R", absPath}
	case "linux":
		cmd = "xdg-open"
		args = []string{absPath}
	case "windows":
		cmd = "explorer"
		args = []string{"/select,", absPath}
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
	return exec.Command(cmd, args...).Start()
}
