package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// EmbeddingRequest is the OpenAI-compatible embedding API payload.
type EmbeddingRequest struct {
	Input []string `json:"input"`
	Model string   `json:"model"`
}

// EmbeddingData represents a single vector in the embedding response.
type EmbeddingData struct {
	Embedding []float32 `json:"embedding"`
	Index     int       `json:"index"`
	Object    string    `json:"object"`
}

// EmbeddingResponse is the response payload from the OpenAI-compatible embedding API.
type EmbeddingResponse struct {
	Data   []EmbeddingData `json:"data"`
	Model  string          `json:"model"`
	Object string          `json:"object"`
	Usage  struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

// Google Gemini native embedding data structures
type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiEmbedRequest struct {
	Model   string        `json:"model"`
	Content geminiContent `json:"content"`
}

type geminiBatchRequest struct {
	Requests []geminiEmbedRequest `json:"requests"`
}

type geminiBatchResponse struct {
	Embeddings []struct {
		Values []float32 `json:"values"`
	} `json:"embeddings"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

// CreateQueryEmbedding generates an embedding vector for a single search query string.
func (c *Client) CreateQueryEmbedding(ctx context.Context, text string) ([]float32, error) {
	embeddings, err := c.CreateBatchEmbeddings(ctx, []string{text})
	if err != nil {
		return nil, err
	}
	if len(embeddings) == 0 {
		return nil, fmt.Errorf("no embedding returned for query")
	}
	return embeddings[0], nil
}

// CreateBatchEmbeddings generates embedding vectors for a list of text strings in batch.
// Automatically detects Google Gemini API vs standard OpenAI-compatible endpoints.
func (c *Client) CreateBatchEmbeddings(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	// If using Google Gemini API (googleapis.com)
	if strings.Contains(c.BaseURL, "googleapis.com") {
		return c.embedGeminiBatch(ctx, texts)
	}

	return c.embedOpenAIBatch(ctx, texts)
}

// embedGeminiBatch calls Google Gemini's native batchEmbedContents API
func (c *Client) embedGeminiBatch(ctx context.Context, texts []string) ([][]float32, error) {
	modelName := c.EmbeddingModel
	if !strings.HasPrefix(modelName, "models/") {
		modelName = "models/" + modelName
	}

	const maxBatchSize = 50
	var allEmbeddings [][]float32

	for i := 0; i < len(texts); i += maxBatchSize {
		end := i + maxBatchSize
		if end > len(texts) {
			end = len(texts)
		}
		batch := texts[i:end]

		var reqList []geminiEmbedRequest
		for _, t := range batch {
			reqList = append(reqList, geminiEmbedRequest{
				Model: modelName,
				Content: geminiContent{
					Parts: []geminiPart{{Text: t}},
				},
			})
		}

		batchReq := geminiBatchRequest{
			Requests: reqList,
		}

		jsonBytes, err := json.Marshal(batchReq)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal Gemini embedding request: %w", err)
		}

		// Google Gemini batch embedding endpoint
		reqURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/%s:batchEmbedContents?key=%s", modelName, c.APIKey)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(jsonBytes))
		if err != nil {
			return nil, fmt.Errorf("failed to create Gemini embedding request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		if c.APIKey != "" {
			req.Header.Set("x-goog-api-key", c.APIKey)
		}

		resp, err := c.HTTPClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to send Gemini embedding request: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read Gemini embedding response body: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("Gemini embedding API returned HTTP %d: %s", resp.StatusCode, string(bodyBytes))
		}

		var geminiResp geminiBatchResponse
		if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil {
			return nil, fmt.Errorf("failed to decode Gemini embedding response: %w", err)
		}

		if geminiResp.Error != nil {
			return nil, fmt.Errorf("Gemini embedding API error: %s", geminiResp.Error.Message)
		}

		if len(geminiResp.Embeddings) != len(batch) {
			return nil, fmt.Errorf("expected %d embeddings from Gemini, got %d", len(batch), len(geminiResp.Embeddings))
		}

		for _, emb := range geminiResp.Embeddings {
			allEmbeddings = append(allEmbeddings, emb.Values)
		}
	}

	return allEmbeddings, nil
}

// embedOpenAIBatch calls standard OpenAI-compatible /embeddings API
func (c *Client) embedOpenAIBatch(ctx context.Context, texts []string) ([][]float32, error) {
	const maxBatchSize = 100
	var allEmbeddings [][]float32

	for i := 0; i < len(texts); i += maxBatchSize {
		end := i + maxBatchSize
		if end > len(texts) {
			end = len(texts)
		}
		batch := texts[i:end]

		reqBody := EmbeddingRequest{
			Input: batch,
			Model: c.EmbeddingModel,
		}

		jsonBytes, err := json.Marshal(reqBody)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal embedding request: %w", err)
		}

		reqURL := fmt.Sprintf("%s/embeddings", c.BaseURL)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(jsonBytes))
		if err != nil {
			return nil, fmt.Errorf("failed to create embedding request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		if c.APIKey != "" {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))
			req.Header.Set("x-goog-api-key", c.APIKey)
		}

		resp, err := c.HTTPClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to send embedding request: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read embedding response body: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("embedding API returned HTTP %d: %s", resp.StatusCode, string(bodyBytes))
		}

		var embResp EmbeddingResponse
		if err := json.Unmarshal(bodyBytes, &embResp); err != nil {
			return nil, fmt.Errorf("failed to decode embedding response: %w", err)
		}

		if embResp.Error != nil {
			return nil, fmt.Errorf("embedding API error: %s", embResp.Error.Message)
		}

		// Ensure order matches input
		batchResult := make([][]float32, len(batch))
		for _, data := range embResp.Data {
			if data.Index < len(batchResult) {
				batchResult[data.Index] = data.Embedding
			}
		}

		allEmbeddings = append(allEmbeddings, batchResult...)
	}

	return allEmbeddings, nil
}
