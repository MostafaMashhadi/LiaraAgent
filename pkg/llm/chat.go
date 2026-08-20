package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// ChatMessage represents a single message in a conversation.
type ChatMessage struct {
	Role    string `json:"role"`    // "system", "user", "assistant"
	Content string `json:"content"` // Message content
}

// ChatRequest represents the payload for OpenAI-compatible chat completion.
type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float32       `json:"temperature"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
}

// ChatResponse represents the response from the chat completion API.
type ChatResponse struct {
	Choices []struct {
		Message      ChatMessage `json:"message"`
		FinishReason string      `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

// Gemini native chat structures
type geminiChatContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiGenerateRequest struct {
	Contents          []geminiChatContent `json:"contents"`
	SystemInstruction *geminiChatContent  `json:"systemInstruction,omitempty"`
	GenerationConfig  struct {
		Temperature float32 `json:"temperature,omitempty"`
	} `json:"generationConfig,omitempty"`
}

type geminiGenerateResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

// CreateChatCompletion sends a chat completion request to the LLM API.
// Supports Google Gemini native generateContent as well as OpenAI-compatible /chat/completions.
func (c *Client) CreateChatCompletion(ctx context.Context, messages []ChatMessage, temperature float32) (string, error) {
	if strings.Contains(c.BaseURL, "googleapis.com") {
		return c.chatGeminiNative(ctx, messages, temperature)
	}

	return c.chatOpenAI(ctx, messages, temperature)
}

// CreateChatCompletionStream streams response tokens chunk-by-chunk via onToken callback.
func (c *Client) CreateChatCompletionStream(ctx context.Context, messages []ChatMessage, temperature float32, onToken func(string) error) (string, error) {
	if onToken == nil {
		return c.CreateChatCompletion(ctx, messages, temperature)
	}

	var res string
	var err error

	if strings.Contains(c.BaseURL, "googleapis.com") {
		res, err = c.chatGeminiNativeStream(ctx, messages, temperature, onToken)
	} else {
		res, err = c.chatOpenAIStream(ctx, messages, temperature, onToken)
	}

	// Fallback to non-streaming completion if streaming returns an error
	if err != nil || res == "" {
		fallbackRes, fallbackErr := c.CreateChatCompletion(ctx, messages, temperature)
		if fallbackErr != nil {
			return "", err
		}
		_ = onToken(fallbackRes)
		return fallbackRes, nil
	}

	return res, nil
}

func (c *Client) chatOpenAIStream(ctx context.Context, messages []ChatMessage, temperature float32, onToken func(string) error) (string, error) {
	reqBody := map[string]interface{}{
		"model":       c.ChatModel,
		"messages":    messages,
		"temperature": temperature,
		"stream":      true,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal chat request: %w", err)
	}

	reqURL := fmt.Sprintf("%s/chat/completions", c.BaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create chat stream request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	if c.APIKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))
		req.Header.Set("x-goog-api-key", c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send chat stream request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("chat stream API returned HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var fullText strings.Builder
	scanner := bufio.NewScanner(resp.Body)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !strings.HasPrefix(line, "data:") {
			continue
		}

		dataStr := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if dataStr == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}

		if err := json.Unmarshal([]byte(dataStr), &chunk); err != nil {
			continue
		}

		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			token := chunk.Choices[0].Delta.Content
			fullText.WriteString(token)
			if err := onToken(token); err != nil {
				return fullText.String(), err
			}
		}
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		return fullText.String(), err
	}

	return fullText.String(), nil
}

func (c *Client) chatGeminiNativeStream(ctx context.Context, messages []ChatMessage, temperature float32, onToken func(string) error) (string, error) {
	modelName := c.ChatModel
	if !strings.HasPrefix(modelName, "models/") {
		modelName = "models/" + modelName
	}

	var contents []geminiChatContent
	var systemInstruction *geminiChatContent

	for _, msg := range messages {
		if msg.Role == "system" {
			systemInstruction = &geminiChatContent{
				Parts: []geminiPart{{Text: msg.Content}},
			}
			continue
		}

		role := "user"
		if msg.Role == "assistant" {
			role = "model"
		}

		contents = append(contents, geminiChatContent{
			Role:  role,
			Parts: []geminiPart{{Text: msg.Content}},
		})
	}

	reqBody := geminiGenerateRequest{
		Contents:          contents,
		SystemInstruction: systemInstruction,
	}
	reqBody.GenerationConfig.Temperature = temperature

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal Gemini chat request: %w", err)
	}

	reqURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/%s:streamGenerateContent?alt=sse&key=%s", modelName, c.APIKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create Gemini chat request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("x-goog-api-key", c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send Gemini chat stream request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Gemini stream API returned HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var fullText strings.Builder
	scanner := bufio.NewScanner(resp.Body)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !strings.HasPrefix(line, "data:") {
			continue
		}

		dataStr := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		var geminiResp geminiGenerateResponse
		if err := json.Unmarshal([]byte(dataStr), &geminiResp); err != nil {
			continue
		}

		if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
			token := geminiResp.Candidates[0].Content.Parts[0].Text
			fullText.WriteString(token)
			if err := onToken(token); err != nil {
				return fullText.String(), err
			}
		}
	}

	return fullText.String(), nil
}

func (c *Client) chatGeminiNative(ctx context.Context, messages []ChatMessage, temperature float32) (string, error) {
	modelName := c.ChatModel
	if !strings.HasPrefix(modelName, "models/") {
		modelName = "models/" + modelName
	}

	var contents []geminiChatContent
	var systemInstruction *geminiChatContent

	for _, msg := range messages {
		if msg.Role == "system" {
			systemInstruction = &geminiChatContent{
				Parts: []geminiPart{{Text: msg.Content}},
			}
			continue
		}

		role := "user"
		if msg.Role == "assistant" {
			role = "model"
		}

		contents = append(contents, geminiChatContent{
			Role:  role,
			Parts: []geminiPart{{Text: msg.Content}},
		})
	}

	reqBody := geminiGenerateRequest{
		Contents:          contents,
		SystemInstruction: systemInstruction,
	}
	reqBody.GenerationConfig.Temperature = temperature

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal Gemini chat request: %w", err)
	}

	reqURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/%s:generateContent?key=%s", modelName, c.APIKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create Gemini chat request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("x-goog-api-key", c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send Gemini chat request: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read Gemini chat response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Gemini chat API returned HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var geminiResp geminiGenerateResponse
	if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil {
		return "", fmt.Errorf("failed to decode Gemini chat response: %w", err)
	}

	if geminiResp.Error != nil {
		return "", fmt.Errorf("Gemini chat API error: %s", geminiResp.Error.Message)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no response candidates returned from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

func (c *Client) chatOpenAI(ctx context.Context, messages []ChatMessage, temperature float32) (string, error) {
	reqBody := ChatRequest{
		Model:       c.ChatModel,
		Messages:    messages,
		Temperature: temperature,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal chat request: %w", err)
	}

	reqURL := fmt.Sprintf("%s/chat/completions", c.BaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create chat request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))
		req.Header.Set("x-goog-api-key", c.APIKey)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send chat request: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read chat response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("chat API returned HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(bodyBytes, &chatResp); err != nil {
		return "", fmt.Errorf("failed to decode chat response: %w", err)
	}

	if chatResp.Error != nil {
		return "", fmt.Errorf("chat API error: %s", chatResp.Error.Message)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no response choices returned from LLM")
	}

	return chatResp.Choices[0].Message.Content, nil
}
