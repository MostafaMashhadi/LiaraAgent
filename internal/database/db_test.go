package database

import (
	"testing"
)

func TestEstimateTokens(t *testing.T) {
	tests := []struct {
		input    string
		minToken int
	}{
		{"", 0},
		{"سلام", 1},
		{"چطور برنامه Node.js را روی پلتفرم ابری لیارا مستقر کنم؟", 12},
		{"Deploying Laravel application with PostgreSQL private network on Liara Cloud", 12},
	}

	for _, tt := range tests {
		got := EstimateTokens(tt.input)
		if tt.minToken == 0 && got != 0 {
			t.Errorf("EstimateTokens(%q) = %d; expected 0", tt.input, got)
		}
		if tt.minToken > 0 && got < tt.minToken {
			t.Errorf("EstimateTokens(%q) = %d; expected at least %d", tt.input, got, tt.minToken)
		}
	}
}
