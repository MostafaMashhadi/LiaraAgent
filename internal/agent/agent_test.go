package agent

import (
	"context"
	"strings"
	"testing"

	"github.com/block-p/liara-helper-agent/internal/rag"
	"github.com/block-p/liara-helper-agent/internal/store"
	"github.com/block-p/liara-helper-agent/pkg/llm"
)

func TestGreetingDetection(t *testing.T) {
	greetings := []string{"سلام", "سلام!", "درود بر شما", "صبح بخیر", "hi", "hello", "سلام خسته نباشید"}
	for _, g := range greetings {
		if !isGreeting(g) {
			t.Errorf("expected isGreeting(%q) to be true", g)
		}
	}

	nonGreetings := []string{"سلام چطور لاراول را دیپلوی کنم؟", "پورت برنامه چیست؟", "خطای 502 دارم"}
	for _, ng := range nonGreetings {
		if isGreeting(ng) {
			t.Errorf("expected isGreeting(%q) to be false", ng)
		}
	}
}

func TestThanksDetection(t *testing.T) {
	thanks := []string{"ممنون", "مرسی", "خیلی ممنون", "دمت گرم", "دستت درد نکنه", "سپاس"}
	for _, th := range thanks {
		if !isThanksOrFarewell(th) {
			t.Errorf("expected isThanksOrFarewell(%q) to be true", th)
		}
	}
}

func TestAgent_GreetingFastResponse(t *testing.T) {
	memStore := store.NewMemoryStore(1536)
	ragEngine := rag.NewEngine(memStore, nil)
	sessionMgr := NewSessionManager(20)
	ag := NewAgent(ragEngine, sessionMgr)

	sessionID := "test-sess-1"
	resp, err := ag.ProcessMessage(context.Background(), sessionID, "سلام")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(resp.Answer, "سلام") {
		t.Errorf("expected greeting answer, got: %s", resp.Answer)
	}

	if len(resp.SuggestedNext) == 0 {
		t.Errorf("expected quick prompt suggestions in greeting response")
	}

	// Verify history recorded
	history := sessionMgr.GetHistory(sessionID)
	if len(history) != 2 {
		t.Errorf("expected 2 messages in session history, got %d", len(history))
	}
	if history[0].Role != "user" || history[1].Role != "assistant" {
		t.Errorf("history roles mismatched: %+v", history)
	}
}

func TestAgent_ConversationalMemoryRetention(t *testing.T) {
	sessionMgr := NewSessionManager(5)
	sessionID := "test-sess-memory"

	sessionMgr.AddMessage(sessionID, llm.ChatMessage{Role: "user", Content: "نحوه ساخت دیتابیس PostgreSQL"})
	sessionMgr.AddMessage(sessionID, llm.ChatMessage{Role: "assistant", Content: "برای ساخت دیتابیس وارد کنسول شوید..."})

	history := sessionMgr.GetHistory(sessionID)
	if len(history) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(history))
	}

	synthesized := synthesizeSearchQuery("حالا چطور بهش وصل شم؟", history)
	if !strings.Contains(synthesized, "PostgreSQL") {
		t.Errorf("expected synthesized query to contain PostgreSQL from previous turn, got: %s", synthesized)
	}
}
