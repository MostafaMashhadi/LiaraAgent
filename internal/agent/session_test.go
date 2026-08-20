package agent

import (
	"testing"

	"github.com/block-p/liara-helper-agent/pkg/llm"
)

func TestSessionManager(t *testing.T) {
	sm := NewSessionManager(3)

	sessionID := "user-123"
	sm.AddMessage(sessionID, llm.ChatMessage{Role: "user", Content: "Hello"})
	sm.AddMessage(sessionID, llm.ChatMessage{Role: "assistant", Content: "Hi!"})
	sm.AddMessage(sessionID, llm.ChatMessage{Role: "user", Content: "How to deploy Go?"})
	sm.AddMessage(sessionID, llm.ChatMessage{Role: "assistant", Content: "Use liara deploy"})

	history := sm.GetHistory(sessionID)
	if len(history) != 3 {
		t.Fatalf("expected sliding window of 3 messages, got %d", len(history))
	}

	if history[0].Content != "Hi!" {
		t.Errorf("expected oldest message in window to be 'Hi!', got %s", history[0].Content)
	}

	if history[2].Content != "Use liara deploy" {
		t.Errorf("expected newest message to be 'Use liara deploy', got %s", history[2].Content)
	}
}
