package rag

import (
	"strings"
	"testing"

	"github.com/block-p/liara-helper-agent/internal/parser"
	"github.com/block-p/liara-helper-agent/internal/store"
)

func TestBuildPrompt(t *testing.T) {
	results := []store.SearchResult{
		{
			Score: 0.95,
			Chunk: parser.DocumentChunk{
				DocTitle:     "مستندات پلتفرم Go",
				SectionTitle: "نحوه تنظیم پورت",
				OriginalURL:  "https://docs.liara.ir/paas/go/port",
				RawBody:      "پورت برنامه باید روی 8080 تنظیم شود.",
			},
		},
	}

	question := "پورت پیش‌فرض Go در لیارا چند است؟"
	prompt := BuildPrompt(question, results)

	if !strings.Contains(prompt, "مستندات پلتفرم Go") {
		t.Errorf("prompt missing doc title")
	}

	if !strings.Contains(prompt, "https://docs.liara.ir/paas/go/port") {
		t.Errorf("prompt missing doc URL")
	}

	if !strings.Contains(prompt, question) {
		t.Errorf("prompt missing question")
	}
}
