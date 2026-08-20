package ws

import (
	"encoding/json"
	"testing"
)

func TestStreamMessage_Serialization(t *testing.T) {
	msg := StreamMessage{
		Type:          "done",
		Message:       "تست پیام",
		SessionID:     "sess_123",
		SuggestedNext: []string{"مرحله ۱", "مرحله ۲"},
		DurationMs:    150,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal StreamMessage: %v", err)
	}

	var parsed StreamMessage
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal StreamMessage: %v", err)
	}

	if parsed.Type != "done" || parsed.Message != "تست پیام" || parsed.SessionID != "sess_123" {
		t.Errorf("mismatched parsed message: %+v", parsed)
	}

	if len(parsed.SuggestedNext) != 2 {
		t.Errorf("expected 2 suggested next items, got %d", len(parsed.SuggestedNext))
	}
}

func TestStreamMessage_TokenStreaming(t *testing.T) {
	tokenMsg := StreamMessage{
		Type:      "token",
		Token:     "سلام ",
		SessionID: "sess_456",
	}

	data, err := json.Marshal(tokenMsg)
	if err != nil {
		t.Fatalf("failed to marshal token message: %v", err)
	}

	var parsed StreamMessage
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal token message: %v", err)
	}

	if parsed.Type != "token" || parsed.Token != "سلام " {
		t.Errorf("mismatched token message: %+v", parsed)
	}
}
