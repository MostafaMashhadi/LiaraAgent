package store

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/block-p/liara-helper-agent/internal/parser"
)

func TestMemoryStore_Search(t *testing.T) {
	memStore := NewMemoryStore(3)

	chunks := []parser.DocumentChunk{
		{ID: "1", DocTitle: "Node.js Guide", Category: "paas", RawBody: "Node.js deploy"},
		{ID: "2", DocTitle: "Postgres Guide", Category: "dbaas", RawBody: "PostgreSQL setup"},
		{ID: "3", DocTitle: "Python Guide", Category: "paas", RawBody: "Python deploy"},
	}

	embeddings := [][]float32{
		{1.0, 0.0, 0.0}, // Vector 1
		{0.0, 1.0, 0.0}, // Vector 2
		{0.9, 0.1, 0.0}, // Vector 3 (similar to Vector 1)
	}

	ctx := context.Background()
	if err := memStore.Add(ctx, chunks, embeddings); err != nil {
		t.Fatalf("failed to add chunks: %v", err)
	}

	// Query closest to Vector 1
	queryVec := []float32{1.0, 0.0, 0.0}
	results, err := memStore.Search(ctx, queryVec, FilterOptions{TopK: 2})
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	if results[0].Chunk.ID != "1" {
		t.Errorf("expected top result to be '1', got %s", results[0].Chunk.ID)
	}

	if results[0].Score < 0.99 {
		t.Errorf("expected score close to 1.0, got %f", results[0].Score)
	}

	if results[1].Chunk.ID != "3" {
		t.Errorf("expected second result to be '3', got %s", results[1].Chunk.ID)
	}

	// Test category filtering
	dbaasResults, err := memStore.Search(ctx, queryVec, FilterOptions{TopK: 5, Category: "dbaas"})
	if err != nil {
		t.Fatalf("search with category failed: %v", err)
	}

	if len(dbaasResults) != 1 || dbaasResults[0].Chunk.ID != "2" {
		t.Errorf("expected only dbaas result '2', got %v", dbaasResults)
	}
}

func TestMemoryStore_SaveAndLoad(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "store-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "index.json")

	store1 := NewMemoryStore(2)
	chunks := []parser.DocumentChunk{
		{ID: "c1", DocTitle: "Test Doc", RawBody: "Sample body"},
	}
	embeddings := [][]float32{{0.5, 0.5}}

	ctx := context.Background()
	_ = store1.Add(ctx, chunks, embeddings)
	store1.SetDocumentHash("test.md", "hash123")

	if err := store1.SaveToFile(filePath); err != nil {
		t.Fatalf("failed to save store: %v", err)
	}

	store2 := NewMemoryStore(2)
	if err := store2.LoadFromFile(filePath); err != nil {
		t.Fatalf("failed to load store: %v", err)
	}

	if store2.Count() != 1 {
		t.Errorf("expected 1 entry in restored store, got %d", store2.Count())
	}

	if !store2.HasDocument("test.md", "hash123") {
		t.Errorf("expected doc hash to be preserved")
	}

	results, err := store2.Search(ctx, []float32{0.5, 0.5}, FilterOptions{TopK: 1})
	if err != nil || len(results) == 0 {
		t.Fatalf("search on restored store failed: %v", err)
	}

	if results[0].Chunk.ID != "c1" {
		t.Errorf("expected chunk ID c1, got %s", results[0].Chunk.ID)
	}
}

func TestPersianStemmingAndSynonyms(t *testing.T) {
	memStore := NewMemoryStore(2)

	chunks := []parser.DocumentChunk{
		{ID: "py1", DocTitle: "راهنمای استقرار برنامه‌های پایتون", FilePath: "src/pages/paas/python/getting-started.mdx", Category: "paas", RawBody: "برای اجرای پروژه پایتونی در لیارا کافیست دستور liara deploy را اجرا کنید."},
		{ID: "node1", DocTitle: "راهنمای استقرار برنامه‌های Node.js", FilePath: "src/pages/paas/nodejs/getting-started.mdx", Category: "paas", RawBody: "برای دیپلوی نودجی‌اس پکیج package.json را تنظیم کنید."},
	}

	ctx := context.Background()
	_ = memStore.Add(ctx, chunks, nil)

	// Search with inflected Persian query
	results, err := memStore.Search(ctx, nil, FilterOptions{
		QueryText: "پروژه پایتونی دارم میخوام اجراش کنم",
		TopK:      1,
	})
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}

	if len(results) == 0 {
		t.Fatalf("expected search results, got 0")
	}

	if results[0].Chunk.ID != "py1" {
		t.Errorf("expected top result to be 'py1' (Python), got %s", results[0].Chunk.ID)
	}
}
