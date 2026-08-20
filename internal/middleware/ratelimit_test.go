package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRateLimiter_Allow(t *testing.T) {
	rl := NewRateLimiter(60) // 60 RPM -> 1 token/sec, cap 60

	// 1. Initial requests for same client
	id := "test-user-1"
	for i := 0; i < 60; i++ {
		allowed, _ := rl.Allow(id, false, false)
		if !allowed {
			t.Fatalf("expected request %d to be allowed", i+1)
		}
	}

	// 61st request should be rejected
	allowed, retryAfter := rl.Allow(id, false, false)
	if allowed {
		t.Errorf("expected 61st request to be rate-limited")
	}
	if retryAfter < 1 {
		t.Errorf("expected retryAfter >= 1, got %d", retryAfter)
	}

	// 2. Different user should be allowed
	id2 := "test-user-2"
	allowed2, _ := rl.Allow(id2, false, false)
	if !allowed2 {
		t.Errorf("expected different user to be allowed")
	}

	// 3. Admin user should always bypass rate limits
	for i := 0; i < 100; i++ {
		allowedAdmin, _ := rl.Allow("admin-user", true, false)
		if !allowedAdmin {
			t.Fatalf("admin request %d was denied", i+1)
		}
	}
}

func TestRateLimiter_AIMiddleware(t *testing.T) {
	rl := NewRateLimiter(60) // AI cap is 20

	handlerCalled := 0
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled++
		w.WriteHeader(http.StatusOK)
	})

	middlewareHandler := rl.AIMiddleware(dummyHandler)

	// Fire 20 AI requests
	for i := 0; i < 20; i++ {
		req := httptest.NewRequest("POST", "/api/chat", nil)
		req.RemoteAddr = "192.168.1.50:1234"
		rr := httptest.NewRecorder()
		middlewareHandler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("request %d failed with code %d", i+1, rr.Code)
		}
	}

	// 21st request should receive 429
	req := httptest.NewRequest("POST", "/api/chat", nil)
	req.RemoteAddr = "192.168.1.50:1234"
	rr := httptest.NewRecorder()
	middlewareHandler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTooManyRequests {
		t.Errorf("expected status 429, got %d", rr.Code)
	}

	retryHeader := rr.Header().Get("Retry-After")
	if retryHeader == "" {
		t.Errorf("expected Retry-After header to be set")
	}

	var respBody map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &respBody); err != nil {
		t.Fatalf("failed to unmarshal JSON response: %v", err)
	}

	if _, ok := respBody["error"]; !ok {
		t.Errorf("expected error field in 429 JSON response")
	}
}
