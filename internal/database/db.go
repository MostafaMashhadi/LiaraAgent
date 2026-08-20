package database

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// User represents a system user account.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	Role         string    `json:"role"` // "admin" or "user"
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ChatSession represents a user conversation session stored in PostgreSQL.
type ChatSession struct {
	ID        string    `json:"id"`
	UserID    *string   `json:"user_id,omitempty"`
	Title     string    `json:"title"`
	Summary   string    `json:"summary"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ChatMessageRecord represents a message stored in PostgreSQL.
type ChatMessageRecord struct {
	ID            string          `json:"id"`
	SessionID     string          `json:"session_id"`
	Role          string          `json:"role"` // "user" or "assistant"
	Content       string          `json:"content"`
	Sources       json.RawMessage `json:"sources,omitempty"`
	SuggestedNext json.RawMessage `json:"suggested_next,omitempty"`
	DurationMs    int64           `json:"duration_ms,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

// AIRequestLog represents an execution record and token consumption of an AI interaction.
type AIRequestLog struct {
	ID               string    `json:"id"`
	UserID           *string   `json:"user_id,omitempty"`
	UserEmail        string    `json:"user_email,omitempty"`
	SessionID        string    `json:"session_id"`
	Endpoint         string    `json:"endpoint"`
	Model            string    `json:"model"`
	Prompt           string    `json:"prompt"`
	Response         string    `json:"response"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	TotalTokens      int       `json:"total_tokens"`
	DurationMs       int64     `json:"duration_ms"`
	Status           string    `json:"status"` // "success", "error"
	CreatedAt        time.Time `json:"created_at"`
}

// SystemSettings holds dynamic runtime settings configurable from the admin panel.
type SystemSettings struct {
	Temperature    float32 `json:"temperature"`
	InputCostPerM  float64 `json:"input_cost_per_m"`  // USD per 1,000,000 prompt tokens (e.g. 0.150 for gpt-4o-mini, 0.075 for gemini-flash)
	OutputCostPerM float64 `json:"output_cost_per_m"` // USD per 1,000,000 completion tokens (e.g. 0.600 for gpt-4o-mini, 0.300 for gemini-flash)
	USDtoTomanRate float64 `json:"usd_to_toman_rate"` // e.g. 90000 Toman per USD
}

// AIRequestStats contains aggregated metrics for admin dashboard.
type AIRequestStats struct {
	TotalRequests         int64   `json:"total_requests"`
	TotalTokens           int64   `json:"total_tokens"`
	TotalPromptTokens     int64   `json:"total_prompt_tokens"`
	TotalCompletionTokens int64   `json:"total_completion_tokens"`
	AvgDurationMs         float64 `json:"avg_duration_ms"`
	TotalUsers            int64   `json:"total_users"`
	EstimatedCostUSD      float64 `json:"estimated_cost_usd"`
	EstimatedCostToman    float64 `json:"estimated_cost_toman"`
	InputCostPerM         float64 `json:"input_cost_per_m"`
	OutputCostPerM        float64 `json:"output_cost_per_m"`
}

// DB wraps the SQL connection and repository operations.
type DB struct {
	db *sql.DB
	mu sync.RWMutex
}

// NewDB connects to PostgreSQL, applies schema migrations, and seeds default users.
func NewDB(connStr, adminEmail, adminPassword string) (*DB, error) {
	if connStr == "" {
		return nil, fmt.Errorf("database connection string is empty")
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		slog.Warn("PostgreSQL ping failed, continuing in fallback mode", "error", err)
		return &DB{db: db}, err
	}

	s := &DB{db: db}
	if err := s.migrate(ctx); err != nil {
		return nil, fmt.Errorf("failed to run database migrations: %w", err)
	}

	if err := s.seedDefaults(ctx, adminEmail, adminPassword); err != nil {
		slog.Warn("failed to seed default users", "error", err)
	}

	slog.Info("PostgreSQL database initialized and migrated successfully")
	return s, nil
}

// Close closes the database connection.
func (d *DB) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

// Ping checks the database liveness.
func (d *DB) Ping(ctx context.Context) error {
	if d.db == nil {
		return fmt.Errorf("database connection is nil")
	}
	return d.db.PingContext(ctx)
}

func (d *DB) migrate(ctx context.Context) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id VARCHAR(64) PRIMARY KEY,
		email VARCHAR(255) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		name VARCHAR(255) NOT NULL DEFAULT '',
		role VARCHAR(32) NOT NULL DEFAULT 'user',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS chat_sessions (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
		title VARCHAR(255) NOT NULL DEFAULT 'گفتگوی جدید',
		summary TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS chat_messages (
		id VARCHAR(64) PRIMARY KEY,
		session_id VARCHAR(64) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
		role VARCHAR(32) NOT NULL,
		content TEXT NOT NULL,
		sources JSONB DEFAULT '[]'::jsonb,
		suggested_next JSONB DEFAULT '[]'::jsonb,
		duration_ms BIGINT DEFAULT 0,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS ai_request_logs (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
		session_id VARCHAR(128) NOT NULL,
		endpoint VARCHAR(64) NOT NULL DEFAULT '/api/chat',
		model VARCHAR(128) NOT NULL DEFAULT 'gpt-4o-mini',
		prompt TEXT NOT NULL,
		response TEXT NOT NULL,
		prompt_tokens INT NOT NULL DEFAULT 0,
		completion_tokens INT NOT NULL DEFAULT 0,
		total_tokens INT NOT NULL DEFAULT 0,
		duration_ms BIGINT NOT NULL DEFAULT 0,
		status VARCHAR(32) NOT NULL DEFAULT 'success',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS system_settings (
		key VARCHAR(64) PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_logs_user_id ON ai_request_logs(user_id);
	CREATE INDEX IF NOT EXISTS idx_logs_created_at ON ai_request_logs(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
	CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
	CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at ASC);
	`
	_, err := d.db.ExecContext(ctx, schema)
	return err
}

func (d *DB) seedDefaults(ctx context.Context, adminEmail, adminPassword string) error {
	if adminEmail == "" {
		adminEmail = "admin@liara.ir"
	}
	if adminPassword == "" {
		adminPassword = "Admin@Liara2026!"
	}

	// Check if admin user exists
	var count int
	err := d.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE email = $1", adminEmail).Scan(&count)
	if err == nil && count == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		if err == nil {
			adminID := "usr_admin_" + randomID(8)
			_, _ = d.db.ExecContext(ctx,
				"INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)",
				adminID, adminEmail, string(hash), "مدیر سیستم لیارا", "admin",
			)
			slog.Info("Default admin user created", "email", adminEmail)
		}
	}

	// Seed test regular user
	userEmail := "user@liara.ir"
	err = d.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users WHERE email = $1", userEmail).Scan(&count)
	if err == nil && count == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte("User@Liara2026!"), bcrypt.DefaultCost)
		if err == nil {
			userID := "usr_user_" + randomID(8)
			_, _ = d.db.ExecContext(ctx,
				"INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)",
				userID, userEmail, string(hash), "کاربر توسعه‌دهنده لیارا", "user",
			)
			slog.Info("Default demo user created", "email", userEmail)
		}
	}

	return nil
}

// CreateUser inserts a new user into the database.
func (d *DB) CreateUser(ctx context.Context, email, password, name, role string) (*User, error) {
	if d.db == nil {
		return nil, fmt.Errorf("database unavailable")
	}

	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if len(password) < 6 {
		return nil, fmt.Errorf("password must be at least 6 characters")
	}
	if role == "" {
		role = "user"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	id := "usr_" + randomID(12)
	now := time.Now()

	query := `
		INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id, email, name, role, created_at, updated_at
	`

	var user User
	err = d.db.QueryRowContext(ctx, query, id, email, string(hash), name, role, now).Scan(
		&user.ID, &user.Email, &user.Name, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
			return nil, fmt.Errorf("کاربری با این ایمیل قبلاً ثبت نام کرده است")
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &user, nil
}

// GetUserByEmail retrieves a user by email.
func (d *DB) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	if d.db == nil {
		return nil, fmt.Errorf("database unavailable")
	}

	email = strings.ToLower(strings.TrimSpace(email))
	query := `SELECT id, email, password_hash, name, role, created_at, updated_at FROM users WHERE email = $1`

	var u User
	err := d.db.QueryRowContext(ctx, query, email).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("کاربری با این ایمیل یافت نشد")
		}
		return nil, err
	}

	return &u, nil
}

// GetUserByID retrieves a user by primary key ID.
func (d *DB) GetUserByID(ctx context.Context, id string) (*User, error) {
	if d.db == nil {
		return nil, fmt.Errorf("database unavailable")
	}

	query := `SELECT id, email, password_hash, name, role, created_at, updated_at FROM users WHERE id = $1`

	var u User
	err := d.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.Role, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}

	return &u, nil
}

// EnsureChatSession creates or ensures a chat session exists in PostgreSQL.
func (d *DB) EnsureChatSession(ctx context.Context, sessionID string, userID *string, initialTitle string) (*ChatSession, error) {
	if d.db == nil {
		return nil, nil
	}

	if initialTitle == "" {
		initialTitle = "گفتگوی جدید"
	}

	query := `
		INSERT INTO chat_sessions (id, user_id, title, summary, created_at, updated_at)
		VALUES ($1, $2, $3, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING id, user_id, title, summary, created_at, updated_at
	`

	var s ChatSession
	err := d.db.QueryRowContext(ctx, query, sessionID, userID, initialTitle).Scan(
		&s.ID, &s.UserID, &s.Title, &s.Summary, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetUserSessions returns all chat sessions for a user (or guest sessions).
func (d *DB) GetUserSessions(ctx context.Context, userID *string) ([]ChatSession, error) {
	if d.db == nil {
		return nil, nil
	}

	var rows *sql.Rows
	var err error

	if userID != nil && *userID != "" {
		query := `SELECT id, user_id, title, summary, created_at, updated_at FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC`
		rows, err = d.db.QueryContext(ctx, query, *userID)
	} else {
		query := `SELECT id, user_id, title, summary, created_at, updated_at FROM chat_sessions WHERE user_id IS NULL ORDER BY updated_at DESC LIMIT 30`
		rows, err = d.db.QueryContext(ctx, query)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []ChatSession
	for rows.Next() {
		var s ChatSession
		if err := rows.Scan(&s.ID, &s.UserID, &s.Title, &s.Summary, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

// SaveChatMessage stores a message in a session.
func (d *DB) SaveChatMessage(ctx context.Context, msg ChatMessageRecord) error {
	if d.db == nil {
		return nil
	}

	if msg.ID == "" {
		msg.ID = "msg_" + randomID(14)
	}
	if len(msg.Sources) == 0 {
		msg.Sources = json.RawMessage("[]")
	}
	if len(msg.SuggestedNext) == 0 {
		msg.SuggestedNext = json.RawMessage("[]")
	}

	query := `
		INSERT INTO chat_messages (id, session_id, role, content, sources, suggested_next, duration_ms, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
	`
	_, err := d.db.ExecContext(ctx, query, msg.ID, msg.SessionID, msg.Role, msg.Content, msg.Sources, msg.SuggestedNext, msg.DurationMs)
	return err
}

// GetSessionMessages returns all messages for a session ordered chronologically.
func (d *DB) GetSessionMessages(ctx context.Context, sessionID string) ([]ChatMessageRecord, error) {
	if d.db == nil {
		return nil, nil
	}

	query := `
		SELECT id, session_id, role, content, sources, suggested_next, duration_ms, created_at
		FROM chat_messages
		WHERE session_id = $1
		ORDER BY created_at ASC
	`
	rows, err := d.db.QueryContext(ctx, query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []ChatMessageRecord
	for rows.Next() {
		var m ChatMessageRecord
		if err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.Sources, &m.SuggestedNext, &m.DurationMs, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, nil
}

// UpdateSessionSummary updates a session's title and summary in PostgreSQL.
func (d *DB) UpdateSessionSummary(ctx context.Context, sessionID, title, summary string) error {
	if d.db == nil {
		return nil
	}
	query := `UPDATE chat_sessions SET title = COALESCE(NULLIF($2, ''), title), summary = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := d.db.ExecContext(ctx, query, sessionID, title, summary)
	return err
}

// DeleteChatSession deletes a session and cascades its messages.
func (d *DB) DeleteChatSession(ctx context.Context, sessionID string) error {
	if d.db == nil {
		return nil
	}
	_, err := d.db.ExecContext(ctx, "DELETE FROM chat_sessions WHERE id = $1", sessionID)
	return err
}

// EstimateTokens calculates estimated token count from text (Persian & English mixed).
func EstimateTokens(text string) int {
	words := strings.Fields(text)
	if len(words) == 0 {
		return 0
	}
	tokens := int(float64(len(words)) * 1.5)
	if tokens < 1 && len(text) > 0 {
		return 1
	}
	return tokens
}

// LogAIRequest records an AI request transaction with token usage in background.
func (d *DB) LogAIRequest(ctx context.Context, log AIRequestLog) error {
	if d.db == nil {
		return nil
	}

	if log.ID == "" {
		log.ID = "log_" + randomID(14)
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}
	if log.TotalTokens == 0 {
		if log.PromptTokens == 0 {
			log.PromptTokens = EstimateTokens(log.Prompt)
		}
		if log.CompletionTokens == 0 {
			log.CompletionTokens = EstimateTokens(log.Response)
		}
		log.TotalTokens = log.PromptTokens + log.CompletionTokens
	}
	if log.Status == "" {
		log.Status = "success"
	}

	query := `
		INSERT INTO ai_request_logs (
			id, user_id, session_id, endpoint, model, prompt, response,
			prompt_tokens, completion_tokens, total_tokens, duration_ms, status, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := d.db.ExecContext(ctx, query,
		log.ID, log.UserID, log.SessionID, log.Endpoint, log.Model,
		log.Prompt, log.Response, log.PromptTokens, log.CompletionTokens,
		log.TotalTokens, log.DurationMs, log.Status, log.CreatedAt,
	)
	return err
}

// GetAIRequestLogs retrieves recent logs with pagination and user email joins.
func (d *DB) GetAIRequestLogs(ctx context.Context, limit, offset int) ([]AIRequestLog, int, error) {
	if d.db == nil {
		return nil, 0, nil
	}

	if limit <= 0 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}

	var total int
	err := d.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM ai_request_logs").Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT 
			l.id, l.user_id, COALESCE(u.email, 'guest') as user_email,
			l.session_id, l.endpoint, l.model, l.prompt, l.response,
			l.prompt_tokens, l.completion_tokens, l.total_tokens,
			l.duration_ms, l.status, l.created_at
		FROM ai_request_logs l
		LEFT JOIN users u ON l.user_id = u.id
		ORDER BY l.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := d.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []AIRequestLog
	for rows.Next() {
		var item AIRequestLog
		err := rows.Scan(
			&item.ID, &item.UserID, &item.UserEmail,
			&item.SessionID, &item.Endpoint, &item.Model,
			&item.Prompt, &item.Response,
			&item.PromptTokens, &item.CompletionTokens, &item.TotalTokens,
			&item.DurationMs, &item.Status, &item.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, item)
	}

	return logs, total, nil
}

// GetSystemSettings loads system configurations from DB with sensible defaults.
func (d *DB) GetSystemSettings(ctx context.Context) (*SystemSettings, error) {
	defaults := &SystemSettings{
		Temperature:    0.3,
		InputCostPerM:  0.150,
		OutputCostPerM: 0.600,
		USDtoTomanRate: 90000.0,
	}
	if d.db == nil {
		return defaults, nil
	}

	var val string
	err := d.db.QueryRowContext(ctx, "SELECT value FROM system_settings WHERE key = 'app_settings'").Scan(&val)
	if err != nil {
		return defaults, nil
	}

	var s SystemSettings
	if err := json.Unmarshal([]byte(val), &s); err != nil {
		return defaults, nil
	}
	if s.Temperature <= 0 {
		s.Temperature = 0.3
	}
	if s.InputCostPerM <= 0 {
		s.InputCostPerM = 0.150
	}
	if s.OutputCostPerM <= 0 {
		s.OutputCostPerM = 0.600
	}
	if s.USDtoTomanRate <= 0 {
		s.USDtoTomanRate = 90000.0
	}
	return &s, nil
}

// SaveSystemSettings persists settings into system_settings table.
func (d *DB) SaveSystemSettings(ctx context.Context, settings SystemSettings) error {
	if d.db == nil {
		return fmt.Errorf("database unavailable")
	}
	if settings.Temperature < 0.0 {
		settings.Temperature = 0.0
	}
	if settings.Temperature > 1.0 {
		settings.Temperature = 1.0
	}
	if settings.InputCostPerM <= 0 {
		settings.InputCostPerM = 0.150
	}
	if settings.OutputCostPerM <= 0 {
		settings.OutputCostPerM = 0.600
	}
	if settings.USDtoTomanRate <= 0 {
		settings.USDtoTomanRate = 90000.0
	}

	data, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	query := `
		INSERT INTO system_settings (key, value, updated_at)
		VALUES ('app_settings', $1, CURRENT_TIMESTAMP)
		ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
	`
	_, err = d.db.ExecContext(ctx, query, string(data))
	return err
}

// GetAIRequestStats computes aggregated token metrics for the admin dashboard.
func (d *DB) GetAIRequestStats(ctx context.Context) (*AIRequestStats, error) {
	if d.db == nil {
		return &AIRequestStats{}, nil
	}

	query := `
		SELECT 
			COUNT(*) as total_requests,
			COALESCE(SUM(total_tokens), 0) as total_tokens,
			COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
			COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
			COALESCE(AVG(duration_ms), 0) as avg_duration_ms
		FROM ai_request_logs
	`

	var stats AIRequestStats
	err := d.db.QueryRowContext(ctx, query).Scan(
		&stats.TotalRequests,
		&stats.TotalTokens,
		&stats.TotalPromptTokens,
		&stats.TotalCompletionTokens,
		&stats.AvgDurationMs,
	)
	if err != nil {
		return nil, err
	}

	_ = d.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)

	settings, _ := d.GetSystemSettings(ctx)
	if settings == nil {
		settings = &SystemSettings{
			InputCostPerM:  0.150,
			OutputCostPerM: 0.600,
			USDtoTomanRate: 90000.0,
		}
	}

	stats.InputCostPerM = settings.InputCostPerM
	stats.OutputCostPerM = settings.OutputCostPerM

	inputCost := (float64(stats.TotalPromptTokens) / 1000000.0) * settings.InputCostPerM
	outputCost := (float64(stats.TotalCompletionTokens) / 1000000.0) * settings.OutputCostPerM
	stats.EstimatedCostUSD = inputCost + outputCost
	stats.EstimatedCostToman = stats.EstimatedCostUSD * settings.USDtoTomanRate

	return &stats, nil
}

func randomID(length int) string {
	bytes := make([]byte, length/2+1)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)[:length]
}
