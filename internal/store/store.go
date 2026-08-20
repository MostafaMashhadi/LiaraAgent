package store

import (
	"context"

	"github.com/block-p/liara-helper-agent/internal/parser"
)

// SearchResult represents a retrieved chunk and its relevance score.
type SearchResult struct {
	Chunk parser.DocumentChunk `json:"chunk"`
	Score float32              `json:"score"` // Cosine similarity score [0.0 - 1.0]
}

// FilterOptions allows filtering vector search by category or metadata.
type FilterOptions struct {
	QueryText   string
	Category    string
	MinScore    float32
	TopK        int
}

// VectorStore defines the common interface for vector storage and retrieval.
// Both the Phase 1 In-Memory Store and Phase 2 pgvector Store implement this interface.
type VectorStore interface {
	// Add inserts document chunks along with their embedding vectors
	Add(ctx context.Context, chunks []parser.DocumentChunk, embeddings [][]float32) error

	// Search performs vector similarity search and returns the top-K matching chunks
	Search(ctx context.Context, queryVector []float32, opts FilterOptions) ([]SearchResult, error)

	// Count returns the total number of chunks indexed in the store
	Count() int

	// HasDocument checks if a document content hash is already up to date
	HasDocument(filePath, contentHash string) bool

	// SaveToFile saves the vector store to a JSON file (In-memory store)
	SaveToFile(path string) error

	// LoadFromFile loads the vector store from a JSON file (In-memory store)
	LoadFromFile(path string) error
}
