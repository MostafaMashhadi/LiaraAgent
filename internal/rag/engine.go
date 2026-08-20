package rag

import (
	"context"
	"fmt"
	"time"

	"github.com/block-p/liara-helper-agent/internal/store"
	"github.com/block-p/liara-helper-agent/pkg/llm"
)

// DocSource represents a cited documentation source.
type DocSource struct {
	Title string `json:"title"`
	URL   string `json:"url"`
	Score float32 `json:"score"`
}

// QueryOptions defines parameters for executing a RAG query.
type QueryOptions struct {
	Category    string
	TopK        int
	MinScore    float32
	Temperature float32
	History     []llm.ChatMessage
}

// QueryResponse contains the LLM answer along with retrieved sources and timing metadata.
type QueryResponse struct {
	Answer          string               `json:"answer"`
	Sources         []DocSource          `json:"sources"`
	RetrievedChunks []store.SearchResult `json:"retrieved_chunks,omitempty"`
	Duration        time.Duration        `json:"duration_ms"`
}

// Engine coordinates the RAG pipeline.
type Engine struct {
	Store     store.VectorStore
	LLMClient *llm.Client
}

// NewEngine creates a new RAG Engine.
func NewEngine(st store.VectorStore, client *llm.Client) *Engine {
	return &Engine{
		Store:     st,
		LLMClient: client,
	}
}

// Query processes a user question through the RAG pipeline with optional conversation history.
func (e *Engine) Query(ctx context.Context, question string, opts QueryOptions) (*QueryResponse, error) {
	return e.QueryStream(ctx, question, opts, nil)
}

// QueryStream executes RAG retrieval and streams generated tokens via onToken callback.
func (e *Engine) QueryStream(ctx context.Context, question string, opts QueryOptions, onToken func(string) error) (*QueryResponse, error) {
	startTime := time.Now()

	if opts.TopK <= 0 {
		opts.TopK = 8
	}
	if opts.Temperature <= 0 {
		opts.Temperature = 0.4
	}

	// 1. Generate embedding for user question (if client available)
	var queryVector []float32
	if e.LLMClient != nil {
		if vec, err := e.LLMClient.CreateQueryEmbedding(ctx, question); err == nil {
			queryVector = vec
		}
	}

	// 2. Search store using Hybrid Search (Dense Vector + Keyword Text Matching)
	searchResults, err := e.Store.Search(ctx, queryVector, store.FilterOptions{
		QueryText: question,
		Category:  opts.Category,
		TopK:      opts.TopK,
		MinScore:  opts.MinScore,
	})
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// 3. Build grounded prompt messages incorporating conversation memory history
	messages := BuildMessagesWithContextAndHistory(question, searchResults, opts.History)

	// 4. Call LLM for completion (streaming or standard)
	var answer string
	if onToken != nil && e.LLMClient != nil {
		answer, err = e.LLMClient.CreateChatCompletionStream(ctx, messages, opts.Temperature, onToken)
	} else if e.LLMClient != nil {
		answer, err = e.LLMClient.CreateChatCompletion(ctx, messages, opts.Temperature)
	} else {
		answer = "خطا: کلاینت مدل زبانی فعال نیست."
	}

	if err != nil {
		return nil, fmt.Errorf("llm completion failed: %w", err)
	}

	// 5. Deduplicate source links
	var sources []DocSource
	seenURLs := make(map[string]bool)

	for _, res := range searchResults {
		if res.Chunk.OriginalURL != "" && !seenURLs[res.Chunk.OriginalURL] {
			seenURLs[res.Chunk.OriginalURL] = true
			sources = append(sources, DocSource{
				Title: res.Chunk.DocTitle,
				URL:   res.Chunk.OriginalURL,
				Score: res.Score,
			})
		}
	}

	return &QueryResponse{
		Answer:          answer,
		Sources:         sources,
		RetrievedChunks: searchResults,
		Duration:        time.Since(startTime),
	}, nil
}
