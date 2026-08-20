package middleware

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/block-p/liara-helper-agent/internal/auth"
)

type clientLimiter struct {
	tokens     float64
	lastRefill time.Time
}

// RateLimiter implements a multi-tier token-bucket rate limiter per User/IP.
type RateLimiter struct {
	mu            sync.Mutex
	clients       map[string]*clientLimiter
	aiClients     map[string]*clientLimiter
	capacity      float64
	refillRate    float64 // tokens per second
	aiCapacity    float64
	aiRefillRate  float64 // tokens per second for AI endpoints
}

// NewRateLimiter creates a RateLimiter with general and AI requests-per-minute limits.
func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	if requestsPerMinute <= 0 {
		requestsPerMinute = 60
	}
	rate := float64(requestsPerMinute) / 60.0

	// AI limit is 20 RPM by default (1 request per 3 seconds)
	aiRPM := 20
	aiRate := float64(aiRPM) / 60.0

	rl := &RateLimiter{
		clients:      make(map[string]*clientLimiter),
		aiClients:    make(map[string]*clientLimiter),
		capacity:     float64(requestsPerMinute),
		refillRate:   rate,
		aiCapacity:   float64(aiRPM),
		aiRefillRate: aiRate,
	}

	// Clean up stale clients periodically
	go rl.cleanupRoutine(10 * time.Minute)

	return rl
}

// Allow checks if a request is allowed for a given client identifier and endpoint tier.
func (rl *RateLimiter) Allow(identifier string, isAdmin bool, isAI bool) (bool, int) {
	if isAdmin {
		return true, 0 // Admins bypass rate limits
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	targetMap := rl.clients
	capVal := rl.capacity
	rateVal := rl.refillRate

	if isAI {
		targetMap = rl.aiClients
		capVal = rl.aiCapacity
		rateVal = rl.aiRefillRate
	}

	cl, exists := targetMap[identifier]
	if !exists {
		targetMap[identifier] = &clientLimiter{
			tokens:     capVal - 1,
			lastRefill: now,
		}
		return true, 0
	}

	// Refill tokens
	elapsed := now.Sub(cl.lastRefill).Seconds()
	cl.tokens += elapsed * rateVal
	if cl.tokens > capVal {
		cl.tokens = capVal
	}
	cl.lastRefill = now

	if cl.tokens >= 1.0 {
		cl.tokens -= 1.0
		return true, 0
	}

	// Calculate wait time until next token is available
	needed := 1.0 - cl.tokens
	retryAfterSec := int(needed / rateVal)
	if retryAfterSec < 1 {
		retryAfterSec = 1
	}

	return false, retryAfterSec
}

func (rl *RateLimiter) cleanupRoutine(interval time.Duration) {
	ticker := time.NewTicker(interval)
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-15 * time.Minute)
		for key, cl := range rl.clients {
			if cl.lastRefill.Before(cutoff) {
				delete(rl.clients, key)
			}
		}
		for key, cl := range rl.aiClients {
			if cl.lastRefill.Before(cutoff) {
				delete(rl.aiClients, key)
			}
		}
		rl.mu.Unlock()
	}
}

// Middleware returns an http.Handler middleware enforcing general rate limits.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, isAdmin := getClientIdentity(r)
		allowed, retryAfter := rl.Allow(id, isAdmin, false)
		if !allowed {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":       "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً چند لحظه صبر کنید.",
				"retry_after": retryAfter,
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// AIMiddleware enforces strict rate limits on expensive AI endpoints.
func (rl *RateLimiter) AIMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, isAdmin := getClientIdentity(r)
		allowed, retryAfter := rl.Allow(id, isAdmin, true)
		if !allowed {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":       "تعداد درخواست‌های هوش مصنوعی شما بیش از حد مجاز است. لطفاً چند لحظه صبر کنید.",
				"retry_after": retryAfter,
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getClientIdentity(r *http.Request) (string, bool) {
	// Check if authenticated user
	if claims := auth.GetClaims(r.Context()); claims != nil {
		isAdmin := claims.Role == "admin"
		return "user:" + claims.UserID, isAdmin
	}

	// Fallback to IP address for unauthenticated users
	return "ip:" + getClientIP(r), false
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return strings.TrimSpace(xrip)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
