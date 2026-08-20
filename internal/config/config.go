package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

// Config holds all configuration variables for the Liara Helper Agent.
type Config struct {
	// LLM & Embeddings API
	APIKey         string
	BaseURL        string
	ChatModel      string
	EmbeddingModel string
	EmbeddingDim   int
	ProxyURL       string

	// Documentation & Vector Store
	RepoDir       string
	DocsDir       string
	IndexPath     string
	WebhookSecret string

	// Server & Security
	ServerPort  string
	RateLimit   int // requests per minute
	CacheTTLMin int // minutes

	// Database & Authentication
	DatabaseURL   string
	JWTSecret     string
	AdminEmail    string
	AdminPassword string
}

// LoadConfig loads configuration from environment variables, optionally reading a .env file.
func LoadConfig() *Config {
	loadDotEnv(".env")

	return &Config{
		APIKey:         getEnv("LLM_API_KEY", ""),
		BaseURL:        getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
		ChatModel:      getEnv("LLM_CHAT_MODEL", "gpt-4o-mini"),
		EmbeddingModel: getEnv("LLM_EMBEDDING_MODEL", "text-embedding-3-small"),
		EmbeddingDim:   getEnvInt("EMBEDDING_DIM", 1536),
		ProxyURL:       getEnv("LLM_PROXY", getEnv("HTTPS_PROXY", getEnv("HTTP_PROXY", ""))),
		RepoDir:        getEnv("REPO_DIR", "data/docs"),
		DocsDir:        getEnv("DOCS_DIR", "data/docs/src/pages"),
		IndexPath:      getEnv("INDEX_PATH", "data/index.json"),
		WebhookSecret:  getEnv("WEBHOOK_SECRET", ""),
		ServerPort:     getEnv("PORT", "8080"),
		RateLimit:      getEnvInt("RATE_LIMIT_RPM", 60),
		CacheTTLMin:    getEnvInt("CACHE_TTL_MINUTES", 60),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://liara:liarapass@localhost:5432/liaradb?sslmode=disable"),
		JWTSecret:      getEnv("JWT_SECRET", "liara-agent-jwt-super-secret-key-2026"),
		AdminEmail:     getEnv("ADMIN_EMAIL", "admin@liara.ir"),
		AdminPassword:  getEnv("ADMIN_PASSWORD", "Admin@Liara2026!"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultVal
}

// Simple .env parser to avoid external dependencies
func loadDotEnv(filename string) {
	file, err := os.Open(filename)
	if err != nil {
		return // .env is optional
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			// Strip surrounding quotes
			v = strings.Trim(v, `"'`)
			if os.Getenv(k) == "" {
				_ = os.Setenv(k, v)
			}
		}
	}
}
