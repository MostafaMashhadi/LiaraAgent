package agent

import (
	"sync"
	"time"

	"github.com/block-p/liara-helper-agent/pkg/llm"
)

// Session represents a multi-turn conversation session with a user.
type Session struct {
	ID        string            `json:"id"`
	Messages  []llm.ChatMessage `json:"messages"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// SessionManager manages active sessions in-memory.
type SessionManager struct {
	mu          sync.RWMutex
	sessions    map[string]*Session
	maxMessages int
}

// NewSessionManager creates a new SessionManager.
func NewSessionManager(maxMessages int) *SessionManager {
	if maxMessages <= 0 {
		maxMessages = 20
	}
	return &SessionManager{
		sessions:    make(map[string]*Session),
		maxMessages: maxMessages,
	}
}

// GetOrCreate retrieves an existing session or creates a new one.
func (sm *SessionManager) GetOrCreate(sessionID string) *Session {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if sess, exists := sm.sessions[sessionID]; exists {
		sess.UpdatedAt = time.Now()
		return sess
	}

	sess := &Session{
		ID:        sessionID,
		Messages:  make([]llm.ChatMessage, 0),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	sm.sessions[sessionID] = sess
	return sess
}

// AddMessage appends a message to a session and prunes oldest if exceeding maxMessages.
func (sm *SessionManager) AddMessage(sessionID string, msg llm.ChatMessage) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sess, exists := sm.sessions[sessionID]
	if !exists {
		sess = &Session{
			ID:        sessionID,
			Messages:  make([]llm.ChatMessage, 0),
			CreatedAt: time.Now(),
		}
		sm.sessions[sessionID] = sess
	}

	sess.Messages = append(sess.Messages, msg)
	sess.UpdatedAt = time.Now()

	// Keep history within token-friendly sliding window
	if len(sess.Messages) > sm.maxMessages {
		sess.Messages = sess.Messages[len(sess.Messages)-sm.maxMessages:]
	}
}

// GetHistory returns the messages for a session.
func (sm *SessionManager) GetHistory(sessionID string) []llm.ChatMessage {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	sess, exists := sm.sessions[sessionID]
	if !exists {
		return nil
	}

	history := make([]llm.ChatMessage, len(sess.Messages))
	copy(history, sess.Messages)
	return history
}

// ClearSession resets history for a session.
func (sm *SessionManager) ClearSession(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.sessions, sessionID)
}
