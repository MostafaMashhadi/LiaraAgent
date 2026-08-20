package store

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/block-p/liara-helper-agent/internal/parser"
	"github.com/block-p/liara-helper-agent/pkg/llm"
)

// EnsureIndex ensures the vector store is populated with documentation chunks and vectors.
func EnsureIndex(ctx context.Context, docsDir, indexPath string, embeddingDim int, memStore *MemoryStore, llmClient *llm.Client) error {
	// 1. Try loading pre-built vector index from disk
	if _, err := os.Stat(indexPath); err == nil {
		slog.Info("loading pre-built vector index from disk", "path", indexPath)
		if err := memStore.LoadFromFile(indexPath); err == nil && memStore.Count() > 0 {
			slog.Info("vector index loaded successfully from disk", "chunks", memStore.Count())
			return nil
		}
		slog.Warn("existing index invalid or empty, will re-index", "path", indexPath)
	}

	// 2. Ingest and chunk all documentation files immediately
	slog.Info("parsing documentation directory", "docs_dir", docsDir)
	startTime := time.Now()

	engine := parser.NewIngestionEngine(nil)
	result, err := engine.IngestDirectory(docsDir)
	if err != nil {
		return fmt.Errorf("failed to ingest documentation directory: %w", err)
	}

	var allChunks []parser.DocumentChunk
	var allTexts []string

	for _, doc := range result.Documents {
		for _, chunk := range doc.Chunks {
			allChunks = append(allChunks, chunk)
			allTexts = append(allTexts, chunk.Content)
		}
	}

	if len(allChunks) == 0 {
		return fmt.Errorf("no document chunks found in %s", docsDir)
	}

	// 3. Add chunks into memory store immediately so Keyword/Hybrid search is 100% active from millisecond 0!
	_ = memStore.Add(ctx, allChunks, nil)
	slog.Info("chunks loaded into in-memory store for instant search",
		"files", result.TotalFiles,
		"chunks", memStore.Count(),
		"duration", time.Since(startTime),
	)

	// 4. Generate embeddings in background or foreground if API key is provided
	if llmClient == nil || llmClient.APIKey == "" {
		slog.Info("running in hybrid keyword search mode (LLM_API_KEY not set)")
		return nil
	}

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()

		slog.Info("generating embedding vectors in background...", "total_chunks", len(allChunks))
		embedStart := time.Now()

		embeddings, err := llmClient.CreateBatchEmbeddings(bgCtx, allTexts)
		if err != nil {
			slog.Error("batch embedding generation failed", "error", err)
			return
		}

		// Re-populate store with embeddings
		newStore := NewMemoryStore(embeddingDim)
		_ = newStore.Add(bgCtx, allChunks, embeddings)

		memStore.mu.Lock()
		memStore.entries = newStore.entries
		memStore.mu.Unlock()

		slog.Info("vector embeddings built and attached to all chunks",
			"indexed_chunks", memStore.Count(),
			"duration", time.Since(embedStart),
		)

		if err := memStore.SaveToFile(indexPath); err != nil {
			slog.Warn("failed to save vector index to disk", "error", err)
		} else {
			slog.Info("saved vector index to disk for instant future startups", "path", indexPath)
		}
	}()

	return nil
}
