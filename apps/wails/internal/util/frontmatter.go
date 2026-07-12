package util

import (
	"regexp"
	"strings"
)

// FrontmatterMeta contains metadata extracted from markdown frontmatter.
type FrontmatterMeta struct {
	Theme     string `json:"themeType,omitempty"`
	ThemeName string `json:"themeName"`
	Title     string `json:"title,omitempty"`
}

var frontmatterRegex = regexp.MustCompile(`^(?:\xEF\xBB\xBF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)`)

// ExtractFrontmatterMeta parses YAML-like frontmatter from markdown content head.
func ExtractFrontmatterMeta(content string) FrontmatterMeta {
	fallback := FrontmatterMeta{ThemeName: "默认主题"}
	m := frontmatterRegex.FindStringSubmatch(content)
	if m == nil {
		return fallback
	}

	fm := m[1]
	theme := extractYAMLValue(fm, "theme")
	themeName := extractYAMLValue(fm, "themeName")
	title := extractYAMLValue(fm, "title")

	result := FrontmatterMeta{
		Theme:     theme,
		ThemeName: fallback.ThemeName,
		Title:     title,
	}
	if themeName != "" {
		result.ThemeName = themeName
	}
	return result
}

// extactYAMLValue extracts a simple YAML key-value from a frontmatter block.
// Handles quoted strings (single/double) and unquoted values.
func extractYAMLValue(fm, key string) string {
	re := regexp.MustCompile(`(?m)^` + regexp.QuoteMeta(key) + `:\s*(.+)$`)
	sub := re.FindStringSubmatch(fm)
	if sub == nil {
		return ""
	}
	raw := strings.TrimSpace(sub[1])
	if len(raw) >= 2 {
		first, last := raw[0], raw[len(raw)-1]
		if (first == '"' && last == '"') || (first == '\'' && last == '\'') {
			inner := raw[1 : len(raw)-1]
			if first == '"' {
				inner = strings.ReplaceAll(inner, `\"`, `"`)
				inner = strings.ReplaceAll(inner, `\\`, `\`)
			}
			return inner
		}
	}
	return raw
}
