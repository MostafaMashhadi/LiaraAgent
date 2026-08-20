package middleware

import (
	"regexp"
	"strings"
)

// DangerousPatterns flags potential prompt injection or system override attempts.
var dangerousPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)ignore\s+(all\s+)?(previous|prior)\s+instructions`),
	regexp.MustCompile(`(?i)disregard\s+(all\s+)?(previous|prior)\s+instructions`),
	regexp.MustCompile(`(?i)you\s+are\s+now\s+(DAN|unrestricted|jailbroken)`),
	regexp.MustCompile(`(?i)reveal\s+(the\s+)?system\s+prompt`),
	regexp.MustCompile(`(?i)show\s+(me\s+)?(your|the)\s+(internal\s+)?instructions`),
}

// SanitizeInput strips control characters and validates prompt safety.
func SanitizeInput(input string) (string, bool) {
	clean := strings.TrimSpace(input)
	if clean == "" {
		return "", false
	}

	// Truncate excessively long queries (> 4000 chars) to avoid DoS/token explosion
	if len(clean) > 4000 {
		clean = clean[:4000]
	}

	for _, pattern := range dangerousPatterns {
		if pattern.MatchString(clean) {
			// Found injection pattern
			return "لطفاً سوال خود را صرفاً در رابطه با سرویس‌ها و نحوه استقرار در پلتفرم لیارا مطرح نمایید.", true
		}
	}

	return clean, false
}
