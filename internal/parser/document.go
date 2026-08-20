package parser

import (
	"fmt"
	"time"
)

// Document represents a fully parsed markdown file from the Liara documentation.
type Document struct {
	FilePath     string          `json:"file_path"`
	Category     string          `json:"category"`      // e.g. "paas", "dbaas", "ai", "object-storage"
	DocTitle     string          `json:"doc_title"`     // e.g. "# سرویس هوش مصنوعی لیارا"
	OriginalURL  string          `json:"original_url"`  // Canonical Liara doc URL e.g. "https://docs.liara.ir/ai/about/"
	ContentHash  string          `json:"content_hash"`  // SHA-256 hash for incremental change detection
	LastModified time.Time       `json:"last_modified"`
	Chunks       []DocumentChunk `json:"chunks"`
}

// DocumentChunk represents a semantic chunk of text derived from a section of a Document.
type DocumentChunk struct {
	ID            string            `json:"id"`            // e.g. "paas/nodejs/getting-started#0"
	FilePath      string            `json:"file_path"`
	Category      string            `json:"category"`      // PaaS, DBaaS, AI, etc.
	Title         string            `json:"title"`         // Clean display title for UI and search
	DocTitle      string            `json:"doc_title"`     // Main document title
	SectionTitle  string            `json:"section_title"` // Heading (e.g. "نحوه تنظیم متغیرهای محیطی")
	OriginalURL   string            `json:"original_url"`  // https://docs.liara.ir/...
	Content       string            `json:"content"`       // Context-enriched content for embedding
	RawBody       string            `json:"raw_body"`      // Exact text chunk
	ChunkIndex    int               `json:"chunk_index"`
	TokenEstimate int               `json:"token_estimate"`
	Metadata      map[string]string `json:"metadata"`
}

// ContextEnrichedContent formats the chunk with full context (Doc Title + Section + URL + Body)
// which improves RAG vector embedding retrieval quality significantly.
func (c *DocumentChunk) ContextEnrichedContent() string {
	if c.DocTitle == "" && c.SectionTitle == "" {
		return c.RawBody
	}
	title := c.DocTitle
	if c.SectionTitle != "" && c.SectionTitle != c.DocTitle {
		title = fmt.Sprintf("%s > %s", c.DocTitle, c.SectionTitle)
	}
	return fmt.Sprintf("Title: %s\nSource: %s\n\n%s", title, c.OriginalURL, c.RawBody)
}
