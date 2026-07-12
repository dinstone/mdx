package service

// UpdateService is a stub for future auto-update functionality.
type UpdateService struct{}

// CheckUpdateResult carries the latest version info.
type CheckUpdateResult struct {
	HasUpdate bool   `json:"hasUpdate"`
	Version   string `json:"version"`
	URL       string `json:"url"`
}

// CheckUpdate returns a stub indicating no update is available.
func (s *UpdateService) CheckUpdate() *CheckUpdateResult {
	return &CheckUpdateResult{
		HasUpdate: false,
		Version:   "",
		URL:       "",
	}
}
