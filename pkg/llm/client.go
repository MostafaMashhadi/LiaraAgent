package llm

import (
	"crypto/tls"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is a generic client for OpenAI-compatible LLM & Embedding APIs
// (including OpenAI, Liara AI, LiteLLM, DeepSeek, Ollama, etc.).
type Client struct {
	APIKey         string
	BaseURL        string
	ChatModel      string
	EmbeddingModel string
	HTTPClient     *http.Client
}

// Config holds client initialization parameters.
type Config struct {
	APIKey         string
	BaseURL        string
	ChatModel      string
	EmbeddingModel string
	ProxyURL       string
	Timeout        time.Duration
}

// NewClient creates a new LLM and Embeddings API client.
func NewClient(cfg Config) *Client {
	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = "https://api.avalai.ir/v1"
	}
	if strings.Contains(baseURL, "googleapis.com") && !strings.HasSuffix(baseURL, "/openai") {
		baseURL = "https://generativelanguage.googleapis.com/v1beta/openai"
	} else if strings.HasSuffix(baseURL, "api.avalai.ir") || strings.HasSuffix(baseURL, "api.openai.com") || strings.HasSuffix(baseURL, "api.liara.ir") {
		baseURL += "/v1"
	}
	chatModel := cfg.ChatModel
	if chatModel == "" {
		chatModel = "gpt-4o-mini"
	}
	embeddingModel := cfg.EmbeddingModel
	if embeddingModel == "" {
		embeddingModel = "text-embedding-3-small"
	}
	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 90 * time.Second
	}

	transport := &http.Transport{
		TLSClientConfig:       &tls.Config{InsecureSkipVerify: false},
		TLSHandshakeTimeout:   30 * time.Second,
		ResponseHeaderTimeout: 60 * time.Second,
		Proxy:                 http.ProxyFromEnvironment,
	}

	if cfg.ProxyURL != "" {
		if proxyURI, err := url.Parse(cfg.ProxyURL); err == nil {
			transport.Proxy = http.ProxyURL(proxyURI)
		}
	}

	return &Client{
		APIKey:         cfg.APIKey,
		BaseURL:        baseURL,
		ChatModel:      chatModel,
		EmbeddingModel: embeddingModel,
		HTTPClient: &http.Client{
			Transport: transport,
			Timeout:   timeout,
		},
	}
}
