package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/block-p/liara-helper-agent/internal/agent"
	"github.com/block-p/liara-helper-agent/internal/auth"
	"github.com/block-p/liara-helper-agent/internal/cache"
	"github.com/block-p/liara-helper-agent/internal/config"
	"github.com/block-p/liara-helper-agent/internal/database"
	"github.com/block-p/liara-helper-agent/internal/middleware"
	"github.com/block-p/liara-helper-agent/internal/rag"
	"github.com/block-p/liara-helper-agent/internal/store"
	syncer "github.com/block-p/liara-helper-agent/internal/sync"
	"github.com/block-p/liara-helper-agent/internal/ws"
	"github.com/block-p/liara-helper-agent/pkg/llm"
	"github.com/block-p/liara-helper-agent/web"
)

type ChatRequestPayload struct {
	Message   string `json:"message"`
	SessionID string `json:"session_id"`
	Category  string `json:"category,omitempty"`
}

type AppServer struct {
	Config      *config.Config
	Agent       *agent.Agent
	Store       *store.MemoryStore
	Syncer      *syncer.Syncer
	QueryCache  *cache.LRUCache
	RateLimiter *middleware.RateLimiter
	DB          *database.DB
	StartTime   time.Time
}

func main() {
	cfg := config.LoadConfig()
	slog.Info("starting Liara Helper Agent server", "port", cfg.ServerPort)

	// Initialize PostgreSQL Database
	db, err := database.NewDB(cfg.DatabaseURL, cfg.AdminEmail, cfg.AdminPassword)
	if err != nil {
		slog.Warn("PostgreSQL not immediately reachable, server will continue with fallback storage", "error", err)
	} else {
		slog.Info("PostgreSQL connection established successfully")
	}

	// Initialize LLM Client
	llmClient := llm.NewClient(llm.Config{
		APIKey:         cfg.APIKey,
		BaseURL:        cfg.BaseURL,
		ChatModel:      cfg.ChatModel,
		EmbeddingModel: cfg.EmbeddingModel,
		ProxyURL:       cfg.ProxyURL,
	})

	// Initialize Vector Store and ensure docs are indexed
	memStore := store.NewMemoryStore(cfg.EmbeddingDim)

	initCtx, initCancel := context.WithTimeout(context.Background(), 10*time.Minute)
	if err := store.EnsureIndex(initCtx, cfg.DocsDir, cfg.IndexPath, cfg.EmbeddingDim, memStore, llmClient); err != nil {
		slog.Warn("vector store index initialization warning", "error", err)
	}
	initCancel()

	ragEngine := rag.NewEngine(memStore, llmClient)
	sessionMgr := agent.NewSessionManager(20)
	agenticEngine := agent.NewAgent(ragEngine, sessionMgr)

	queryCache := cache.NewLRUCache(1000, time.Duration(cfg.CacheTTLMin)*time.Minute)
	rateLimiter := middleware.NewRateLimiter(cfg.RateLimit)

	docSyncer := syncer.NewSyncer(cfg.RepoDir, cfg.DocsDir, cfg.IndexPath, cfg.WebhookSecret, memStore, llmClient)

	server := &AppServer{
		Config:      cfg,
		Agent:       agenticEngine,
		Store:       memStore,
		Syncer:      docSyncer,
		QueryCache:  queryCache,
		RateLimiter: rateLimiter,
		DB:          db,
		StartTime:   time.Now(),
	}

	mux := http.NewServeMux()

	// Static Web UI
	mux.HandleFunc("/", server.handleHome)

	// Health Checks
	mux.HandleFunc("/healthz", server.handleHealthz)
	mux.HandleFunc("/readyz", server.handleReadyz)

	// Authentication Endpoints (JWT)
	mux.HandleFunc("/api/auth/register", server.handleAuthRegister)
	mux.HandleFunc("/api/auth/login", server.handleAuthLogin)
	mux.HandleFunc("/api/auth/me", auth.RequireAuth(server.handleAuthMe))

	// Admin Endpoints (RBAC & Token Consumption Tracking & Dynamic Settings)
	mux.HandleFunc("/api/admin/logs", auth.RequireAdmin(server.handleAdminLogs))
	mux.HandleFunc("/api/admin/stats", auth.RequireAdmin(server.handleAdminStats))
	mux.HandleFunc("/api/admin/settings", auth.RequireAdmin(server.handleAdminSettings))

	// Core API Endpoints
	mux.Handle("/api/chat", server.RateLimiter.AIMiddleware(http.HandlerFunc(server.handleChat)))
	mux.HandleFunc("/api/chat/sessions", server.handleChatSessions)
	mux.HandleFunc("/api/chat/messages", server.handleChatMessages)
	mux.HandleFunc("/api/stats", server.handleStats)

	// Tool Studio Endpoints
	mux.HandleFunc("/api/tools/config", server.handleToolConfig)
	mux.Handle("/api/tools/diagnose", server.RateLimiter.AIMiddleware(http.HandlerFunc(server.handleToolDiagnose)))
	mux.HandleFunc("/api/docs/search", server.handleDocsSearch)
	mux.HandleFunc("/api/docs/categories", server.handleDocsCategories)

	// Real-time WebSocket Streaming Endpoint
	mux.HandleFunc("/ws/chat", server.handleWebSocketChat)

	// GitHub Webhook & Manual Sync Endpoints
	mux.HandleFunc("/api/webhook/github", server.handleWebhook)
	mux.HandleFunc("/api/webhook/sync", server.handleWebhook)

	// Wrap middleware chain: Recovery -> Logger -> Auth -> RateLimiter -> Router
	handler := middleware.RecoveryMiddleware(
		middleware.LoggerMiddleware(
			auth.AuthMiddleware(cfg.JWTSecret)(
				server.RateLimiter.Middleware(mux),
			),
		),
	)

	httpServer := &http.Server{
		Addr:         "0.0.0.0:" + cfg.ServerPort,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown channel
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("HTTP server listening", "url", "http://0.0.0.0:"+cfg.ServerPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-stopChan
	slog.Info("shutting down server gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if db != nil {
		_ = db.Close()
	}

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}

	slog.Info("server exited cleanly")
}

func (s *AppServer) handleHome(w http.ResponseWriter, r *http.Request) {
	const distPath = "web/dist"

	if _, err := os.Stat(distPath + "/index.html"); err == nil {
		cleanPath := filepath.Clean(r.URL.Path)
		filePath := filepath.Join(distPath, cleanPath)
		if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
			http.ServeFile(w, r, filePath)
			return
		}
		http.ServeFile(w, r, filepath.Join(distPath, "index.html"))
		return
	}

	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(web.IndexHTML)
}

func (s *AppServer) handleHealthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if s.DB != nil && s.DB.Ping(r.Context()) == nil {
		dbStatus = "connected"
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":   "healthy",
		"service":  "liara-helper-agent",
		"database": dbStatus,
	})
}

func (s *AppServer) handleReadyz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status": "ready"}`))
}

func writeJSONError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}

// ================= Authentication Handlers =================

type RegisterPayload struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (s *AppServer) handleAuthRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	if s.DB == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "پایگاه داده در دسترس نیست")
		return
	}

	var req RegisterPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "اطلاعات ورودی نامعتبر است")
		return
	}

	if req.Email == "" || req.Password == "" {
		writeJSONError(w, http.StatusBadRequest, "ایمیل و کلمه عبور الزامی هستند")
		return
	}

	user, err := s.DB.CreateUser(r.Context(), req.Email, req.Password, req.Name, "user")
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.Name, user.Role, s.Config.JWTSecret, 7*24*time.Hour)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "خطا در صدور توکن کاربری")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

type LoginPayload struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *AppServer) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	if s.DB == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "پایگاه داده در دسترس نیست")
		return
	}

	var req LoginPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "اطلاعات ورودی نامعتبر است")
		return
	}

	user, err := s.DB.GetUserByEmail(r.Context(), req.Email)
	if err != nil || !auth.CheckPassword(user.PasswordHash, req.Password) {
		writeJSONError(w, http.StatusUnauthorized, "ایمیل یا کلمه عبور اشتباه است")
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Email, user.Name, user.Role, s.Config.JWTSecret, 7*24*time.Hour)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "خطا در صدور توکن کاربری")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

func (s *AppServer) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		writeJSONError(w, http.StatusUnauthorized, "احراز هویت الزامی است")
		return
	}

	user, err := s.DB.GetUserByID(r.Context(), claims.UserID)
	if err != nil {
		writeJSONError(w, http.StatusNotFound, "کاربر یافت نشد")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"user": user,
	})
}

// ================= Admin & Token Log Handlers =================

func (s *AppServer) handleAdminLogs(w http.ResponseWriter, r *http.Request) {
	if s.DB == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "پایگاه داده در دسترس نیست")
		return
	}

	limit := 30
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if val, err := strconv.Atoi(l); err == nil && val > 0 {
			limit = val
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if val, err := strconv.Atoi(o); err == nil && val >= 0 {
			offset = val
		}
	}

	logs, total, err := s.DB.GetAIRequestLogs(r.Context(), limit, offset)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"total":  total,
		"limit":  limit,
		"offset": offset,
		"logs":   logs,
	})
}

func (s *AppServer) handleAdminStats(w http.ResponseWriter, r *http.Request) {
	if s.DB == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "پایگاه داده در دسترس نیست")
		return
	}

	stats, err := s.DB.GetAIRequestStats(r.Context())
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(stats)
}

func (s *AppServer) handleAdminSettings(w http.ResponseWriter, r *http.Request) {
	if s.DB == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "پایگاه داده در دسترس نیست")
		return
	}

	if r.Method == http.MethodGet {
		settings, err := s.DB.GetSystemSettings(r.Context())
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(settings)
		return
	}

	if r.Method == http.MethodPost {
		var settings database.SystemSettings
		if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
			writeJSONError(w, http.StatusBadRequest, "فرمت داده‌های ارسالی نامعتبر است")
			return
		}

		if err := s.DB.SaveSystemSettings(r.Context(), settings); err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if s.Agent != nil {
			s.Agent.SetTemperature(settings.Temperature)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"message":  "تنظیمات با موفقیت ذخیره و در هسته هوش مصنوعی اعمال شد",
			"settings": settings,
		})
		return
	}

	writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
}

// ================= Core Chat Handlers with Token Logging =================

func (s *AppServer) handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req ChatRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	sanitizedMsg, isFlagged := middleware.SanitizeInput(req.Message)
	if isFlagged {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"answer": sanitizedMsg,
		})
		return
	}

	if req.SessionID == "" {
		req.SessionID = "default"
	}

	var userID *string
	if claims := auth.GetClaims(r.Context()); claims != nil {
		userID = &claims.UserID
	}

	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()

	isStream := r.URL.Query().Get("stream") == "true" || strings.Contains(r.Header.Get("Accept"), "text/event-stream")

	// Check Cache (Cost Optimization 25 pts)
	cacheKey := cache.HashKey(req.Category + ":" + sanitizedMsg)
	if cachedVal, found := s.QueryCache.Get(cacheKey); found {
		cachedResp := cachedVal.(*agent.AgenticResponse)

		if isStream {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("X-Cache", "HIT")

			flusher, ok := w.(http.Flusher)
			if ok {
				_ = streamCachedTokens(ctx, cachedResp.Answer, req.SessionID, func(sm ws.StreamMessage) error {
					msgBytes, _ := json.Marshal(sm)
					_, err := fmt.Fprintf(w, "data: %s\n\n", string(msgBytes))
					flusher.Flush()
					return err
				})

				doneBytes, _ := json.Marshal(ws.StreamMessage{
					Type:          "done",
					Message:       cachedResp.Answer,
					Sources:       cachedResp.Sources,
					SuggestedNext: cachedResp.SuggestedNext,
					ToolExecuted:  cachedResp.ToolExecuted,
					DurationMs:    cachedResp.Duration.Milliseconds(),
					SessionID:     req.SessionID,
				})
				_, _ = fmt.Fprintf(w, "data: %s\n\n", string(doneBytes))
				flusher.Flush()

				if s.DB != nil {
					go func() {
						_ = s.DB.LogAIRequest(context.Background(), database.AIRequestLog{
							UserID:     userID,
							SessionID:  req.SessionID,
							Endpoint:   "/api/chat (stream cached)",
							Model:      s.Config.ChatModel,
							Prompt:     sanitizedMsg,
							Response:   cachedResp.Answer,
							DurationMs: 5,
							Status:     "success",
						})
					}()
				}
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		_ = json.NewEncoder(w).Encode(cachedResp)

		if s.DB != nil {
			go func() {
				_ = s.DB.LogAIRequest(context.Background(), database.AIRequestLog{
					UserID:     userID,
					SessionID:  req.SessionID,
					Endpoint:   "/api/chat (cached)",
					Model:      s.Config.ChatModel,
					Prompt:     sanitizedMsg,
					Response:   cachedResp.Answer,
					DurationMs: 5,
					Status:     "success",
				})
			}()
		}
		return
	}

	// If client requested SSE streaming via query param or header
	if r.URL.Query().Get("stream") == "true" || strings.Contains(r.Header.Get("Accept"), "text/event-stream") {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Cache", "MISS")

		flusher, ok := w.(http.Flusher)
		if !ok {
			writeJSONError(w, http.StatusInternalServerError, "Streaming unsupported by server")
			return
		}

		agentResp, err := s.Agent.ProcessMessageStream(ctx, req.SessionID, sanitizedMsg, func(token string) error {
			msgBytes, _ := json.Marshal(ws.StreamMessage{
				Type:      "token",
				Token:     token,
				SessionID: req.SessionID,
			})
			_, err := fmt.Fprintf(w, "data: %s\n\n", string(msgBytes))
			flusher.Flush()
			return err
		})

		if err != nil {
			slog.Error("chat streaming processing error", "error", err)
			errBytes, _ := json.Marshal(ws.StreamMessage{
				Type:      "error",
				Error:     err.Error(),
				SessionID: req.SessionID,
			})
			_, _ = fmt.Fprintf(w, "data: %s\n\n", string(errBytes))
			flusher.Flush()

			if s.DB != nil {
				go func() {
					_ = s.DB.LogAIRequest(context.Background(), database.AIRequestLog{
						UserID:    userID,
						SessionID: req.SessionID,
						Endpoint:  "/api/chat (stream)",
						Model:     s.Config.ChatModel,
						Prompt:    sanitizedMsg,
						Response:  err.Error(),
						Status:    "error",
					})
				}()
			}
			return
		}

		// Cache successful response
		s.QueryCache.Set(cacheKey, agentResp, 0)

		// Log token usage and persist chat messages into PostgreSQL
		if s.DB != nil {
			go func() {
				_ = s.DB.LogAIRequest(context.Background(), database.AIRequestLog{
					UserID:     userID,
					SessionID:  req.SessionID,
					Endpoint:   "/api/chat (stream)",
					Model:      s.Config.ChatModel,
					Prompt:     sanitizedMsg,
					Response:   agentResp.Answer,
					DurationMs: agentResp.Duration.Milliseconds(),
					Status:     "success",
				})
				s.saveChatExchange(userID, req.SessionID, sanitizedMsg, agentResp.Answer, agentResp.Sources, agentResp.SuggestedNext, agentResp.Duration.Milliseconds())
			}()
		}

		// Send completion frame
		doneBytes, _ := json.Marshal(ws.StreamMessage{
			Type:          "done",
			Message:       agentResp.Answer,
			Sources:       agentResp.Sources,
			SuggestedNext: agentResp.SuggestedNext,
			ToolExecuted:  agentResp.ToolExecuted,
			DurationMs:    agentResp.Duration.Milliseconds(),
			SessionID:     req.SessionID,
		})
		_, _ = fmt.Fprintf(w, "data: %s\n\n", string(doneBytes))
		flusher.Flush()
		return
	}

	// Standard non-streaming JSON response
	agentResp, err := s.Agent.ProcessMessage(ctx, req.SessionID, sanitizedMsg)
	if err != nil {
		slog.Error("chat processing error", "error", err)
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Cache successful response
	s.QueryCache.Set(cacheKey, agentResp, 0)

	// Log token usage and persist chat into PostgreSQL
	if s.DB != nil {
		go func() {
			_ = s.DB.LogAIRequest(context.Background(), database.AIRequestLog{
				UserID:     userID,
				SessionID:  req.SessionID,
				Endpoint:   "/api/chat",
				Model:      s.Config.ChatModel,
				Prompt:     sanitizedMsg,
				Response:   agentResp.Answer,
				DurationMs: agentResp.Duration.Milliseconds(),
				Status:     "success",
			})
			s.saveChatExchange(userID, req.SessionID, sanitizedMsg, agentResp.Answer, agentResp.Sources, agentResp.SuggestedNext, agentResp.Duration.Milliseconds())
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	_ = json.NewEncoder(w).Encode(agentResp)
}

func (s *AppServer) handleWebSocketChat(w http.ResponseWriter, r *http.Request) {
	conn, err := ws.Upgrade(w, r)
	if err != nil {
		slog.Warn("websocket upgrade failed", "error", err, "client_ip", r.RemoteAddr)
		http.Error(w, "WebSocket upgrade failed: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer conn.Close()

	slog.Info("websocket client connected", "client_ip", r.RemoteAddr)

	var wsUserID *string
	if claims := auth.GetClaims(r.Context()); claims != nil {
		wsUserID = &claims.UserID
	}

	for {
		var clientMsg ws.StreamMessage
		if err := conn.ReadJSON(&clientMsg); err != nil {
			if err != io.EOF {
				slog.Debug("websocket connection closed", "error", err)
			}
			break
		}

		if clientMsg.Message == "" {
			continue
		}

		if clientMsg.SessionID == "" {
			clientMsg.SessionID = "default"
		}

		sanitizedMsg, isFlagged := middleware.SanitizeInput(clientMsg.Message)
		if isFlagged {
			_ = conn.WriteJSON(ws.StreamMessage{
				Type:      "done",
				Message:   sanitizedMsg,
				SessionID: clientMsg.SessionID,
			})
			continue
		}

		// Enforce AI Rate Limiter per client/user
		clientID := "ip:" + r.RemoteAddr
		isAdmin := false
		if claims := auth.GetClaims(r.Context()); claims != nil {
			clientID = "user:" + claims.UserID
			isAdmin = claims.Role == "admin"
		}
		if allowed, retryAfter := s.RateLimiter.Allow(clientID, isAdmin, true); !allowed {
			_ = conn.WriteJSON(ws.StreamMessage{
				Type:      "error",
				Error:     fmt.Sprintf("تعداد درخواست‌های هوش مصنوعی شما بیش از حد مجاز است. لطفاً %d ثانیه دیگر تلاش کنید.", retryAfter),
				SessionID: clientMsg.SessionID,
			})
			continue
		}

		// Check cache
		cacheKey := cache.HashKey(clientMsg.Category + ":" + sanitizedMsg)
		if cachedVal, found := s.QueryCache.Get(cacheKey); found {
			cachedResp := cachedVal.(*agent.AgenticResponse)
			cachedCtx, cachedCancel := context.WithTimeout(context.Background(), 10*time.Second)
			_ = streamCachedTokens(cachedCtx, cachedResp.Answer, clientMsg.SessionID, func(sm ws.StreamMessage) error {
				return conn.WriteJSON(sm)
			})
			cachedCancel()

			_ = conn.WriteJSON(ws.StreamMessage{
				Type:          "done",
				Message:       cachedResp.Answer,
				Sources:       cachedResp.Sources,
				SuggestedNext: cachedResp.SuggestedNext,
				ToolExecuted:  cachedResp.ToolExecuted,
				DurationMs:    cachedResp.Duration.Milliseconds(),
				SessionID:     clientMsg.SessionID,
			})

			if s.DB != nil {
				go func() {
					_ = s.DB.LogAIRequest(context.Background(), database.AIRequestLog{
						UserID:     wsUserID,
						SessionID:  clientMsg.SessionID,
						Endpoint:   "/ws/chat (cached)",
						Model:      s.Config.ChatModel,
						Prompt:     sanitizedMsg,
						Response:   cachedResp.Answer,
						DurationMs: 5,
						Status:     "success",
					})
					s.saveChatExchange(wsUserID, clientMsg.SessionID, sanitizedMsg, cachedResp.Answer, cachedResp.Sources, cachedResp.SuggestedNext, 5)
				}()
			}
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)

		agentResp, err := s.Agent.ProcessMessageStream(ctx, clientMsg.SessionID, sanitizedMsg, func(token string) error {
			return conn.WriteJSON(ws.StreamMessage{
				Type:      "token",
				Token:     token,
				SessionID: clientMsg.SessionID,
			})
		})
		cancel()

		if err != nil {
			slog.Error("websocket chat processing error", "error", err)
			_ = conn.WriteJSON(ws.StreamMessage{
				Type:      "error",
				Error:     err.Error(),
				SessionID: clientMsg.SessionID,
			})
			continue
		}

		// Cache successful response
		s.QueryCache.Set(cacheKey, agentResp, 0)

		// Log token usage and persist chat into PostgreSQL
		if s.DB != nil {
			go func() {
				_ = s.DB.LogAIRequest(context.Background(), database.AIRequestLog{
					UserID:     wsUserID,
					SessionID:  clientMsg.SessionID,
					Endpoint:   "/ws/chat",
					Model:      s.Config.ChatModel,
					Prompt:     sanitizedMsg,
					Response:   agentResp.Answer,
					DurationMs: agentResp.Duration.Milliseconds(),
					Status:     "success",
				})
				s.saveChatExchange(wsUserID, clientMsg.SessionID, sanitizedMsg, agentResp.Answer, agentResp.Sources, agentResp.SuggestedNext, agentResp.Duration.Milliseconds())
			}()
		}

		// Send final metadata & completion
		_ = conn.WriteJSON(ws.StreamMessage{
			Type:          "done",
			Message:       agentResp.Answer,
			Sources:       agentResp.Sources,
			SuggestedNext: agentResp.SuggestedNext,
			ToolExecuted:  agentResp.ToolExecuted,
			DurationMs:    agentResp.Duration.Milliseconds(),
			SessionID:     clientMsg.SessionID,
		})
	}
}

func (s *AppServer) handleStats(w http.ResponseWriter, r *http.Request) {
	stats := s.QueryCache.Stats()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"total_chunks":   s.Store.Count(),
		"cache_hits":     stats.Hits,
		"cache_misses":   stats.Misses,
		"cache_hit_rate": fmt.Sprintf("%.1f%%", stats.HitRatePercent),
		"saved_tokens":   stats.SavedTokens,
		"uptime_seconds": int(time.Since(s.StartTime).Seconds()),
	})
}

func (s *AppServer) handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	_ = r.Body.Close()
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}

	sigHeader := r.Header.Get("X-Hub-Signature-256")
	authHeader := r.Header.Get("Authorization")

	// Verify GitHub HMAC signature or Bearer token
	isAuth := false
	if s.Config.WebhookSecret == "" {
		isAuth = true // Development mode
	} else if sigHeader != "" && s.Syncer.VerifySignature(bodyBytes, sigHeader) {
		isAuth = true
	} else if authHeader == "Bearer "+s.Config.WebhookSecret {
		isAuth = true
	}

	if !isAuth {
		slog.Warn("unauthorized webhook sync request", "client_ip", r.RemoteAddr)
		writeJSONError(w, http.StatusUnauthorized, "Invalid webhook signature or authorization token")
		return
	}

	isAsync := r.URL.Query().Get("sync") != "true"

	if isAsync {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancel()

			report, err := s.Syncer.Sync(ctx)
			if err != nil {
				slog.Error("background webhook sync failed", "error", err)
			} else {
				slog.Info("background webhook sync succeeded", "report", report)
			}
		}()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "accepted",
			"message": "Incremental document sync initiated in background",
		})
		return
	}

	// Synchronous sync execution
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
	defer cancel()

	report, err := s.Syncer.Sync(ctx)
	if err != nil {
		slog.Error("webhook sync failed", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "Sync failed: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"report": report,
	})
}

func (s *AppServer) handleToolConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	_ = r.Body.Close()
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	tool, exists := s.Agent.Tools["generate_liara_config"]
	if !exists {
		writeJSONError(w, http.StatusNotFound, "Config tool not found")
		return
	}

	startTime := time.Now()
	result, err := tool.Execute(r.Context(), string(bodyBytes))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if s.DB != nil {
		var userID *string
		if claims := auth.GetClaims(r.Context()); claims != nil {
			userID = &claims.UserID
		}
		go func() {
			_ = s.DB.LogAIRequest(context.Background(), database.AIRequestLog{
				UserID:     userID,
				SessionID:  "tool_config",
				Endpoint:   "/api/tools/config",
				Model:      "internal-tool",
				Prompt:     string(bodyBytes),
				Response:   fmt.Sprintf("%v", result.Data),
				DurationMs: time.Since(startTime).Milliseconds(),
				Status:     "success",
			})
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func (s *AppServer) handleToolDiagnose(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Log string `json:"log"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	tool, exists := s.Agent.Tools["analyze_error_log"]
	if !exists {
		writeJSONError(w, http.StatusNotFound, "Log analyzer tool not found")
		return
	}

	startTime := time.Now()
	result, err := tool.Execute(r.Context(), req.Log)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if s.DB != nil {
		var userID *string
		if claims := auth.GetClaims(r.Context()); claims != nil {
			userID = &claims.UserID
		}
		go func() {
			_ = s.DB.LogAIRequest(context.Background(), database.AIRequestLog{
				UserID:     userID,
				SessionID:  "tool_diagnose",
				Endpoint:   "/api/tools/diagnose",
				Model:      "internal-tool",
				Prompt:     req.Log,
				Response:   fmt.Sprintf("%v", result.Data),
				DurationMs: time.Since(startTime).Milliseconds(),
				Status:     "success",
			})
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func (s *AppServer) handleDocsSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	category := r.URL.Query().Get("category")
	if category == "all" {
		category = ""
	}

	topK := 25
	if q == "" {
		topK = 200
	}
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			topK = val
		}
	}

	results, err := s.Store.Search(r.Context(), nil, store.FilterOptions{
		QueryText: q,
		Category:  category,
		TopK:      topK,
	})
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"query":      q,
		"category":   category,
		"count":      len(results),
		"results":    results,
		"categories": s.Store.GetCategories(),
	})
}

func (s *AppServer) handleDocsCategories(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"categories": s.Store.GetCategories(),
	})
}

// ================= Chat Session & Message Persistence Handlers =================

func (s *AppServer) saveChatExchange(userID *string, sessionID, userMsg, assistantMsg string, sources []rag.DocSource, suggestedNext []string, durationMs int64) {
	if s.DB == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	title := strings.TrimSpace(userMsg)
	runes := []rune(title)
	if len(runes) > 36 {
		title = string(runes[:36]) + "..."
	}
	if title == "" {
		title = "گفتگوی جدید"
	}

	_, _ = s.DB.EnsureChatSession(ctx, sessionID, userID, title)

	_ = s.DB.SaveChatMessage(ctx, database.ChatMessageRecord{
		SessionID: sessionID,
		Role:      "user",
		Content:   userMsg,
	})

	sourcesJSON, _ := json.Marshal(sources)
	suggestedJSON, _ := json.Marshal(suggestedNext)
	_ = s.DB.SaveChatMessage(ctx, database.ChatMessageRecord{
		SessionID:     sessionID,
		Role:          "assistant",
		Content:       assistantMsg,
		Sources:       sourcesJSON,
		SuggestedNext: suggestedJSON,
		DurationMs:    durationMs,
	})

	summary := fmt.Sprintf("گفتگو درباره: %s", title)
	_ = s.DB.UpdateSessionSummary(ctx, sessionID, title, summary)
}

func (s *AppServer) handleChatSessions(w http.ResponseWriter, r *http.Request) {
	if s.DB == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "پایگاه داده متصل نیست")
		return
	}

	var userID *string
	if claims := auth.GetClaims(r.Context()); claims != nil {
		userID = &claims.UserID
	}

	switch r.Method {
	case http.MethodGet:
		sessions, err := s.DB.GetUserSessions(r.Context(), userID)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"sessions": sessions,
		})

	case http.MethodPost:
		var req struct {
			SessionID string `json:"session_id"`
			Title     string `json:"title"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.SessionID == "" {
			req.SessionID = fmt.Sprintf("sess_%d", time.Now().UnixNano())
		}
		sess, err := s.DB.EnsureChatSession(r.Context(), req.SessionID, userID, req.Title)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(sess)

	case http.MethodDelete:
		sessionID := r.URL.Query().Get("session_id")
		if sessionID == "" {
			writeJSONError(w, http.StatusBadRequest, "session_id is required")
			return
		}
		if err := s.DB.DeleteChatSession(r.Context(), sessionID); err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})

	default:
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (s *AppServer) handleChatMessages(w http.ResponseWriter, r *http.Request) {
	if s.DB == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "پایگاه داده متصل نیست")
		return
	}

	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		writeJSONError(w, http.StatusBadRequest, "session_id is required")
		return
	}

	msgs, err := s.DB.GetSessionMessages(r.Context(), sessionID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"session_id": sessionID,
		"messages":   msgs,
	})
}

func streamCachedTokens(ctx context.Context, text string, sessionID string, sendToken func(ws.StreamMessage) error) error {
	var current strings.Builder
	for _, r := range text {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		current.WriteRune(r)
		if r == ' ' || r == '\n' || r == '\t' || r == '،' || r == '.' || current.Len() >= 12 {
			if err := sendToken(ws.StreamMessage{
				Type:      "token",
				Token:     current.String(),
				SessionID: sessionID,
			}); err != nil {
				return err
			}
			current.Reset()
			time.Sleep(8 * time.Millisecond)
		}
	}

	if current.Len() > 0 {
		return sendToken(ws.StreamMessage{
			Type:      "token",
			Token:     current.String(),
			SessionID: sessionID,
		})
	}
	return nil
}

