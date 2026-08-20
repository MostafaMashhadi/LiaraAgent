package middleware

import (
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
)

// RecoveryMiddleware gracefully recovers from panics, logs stack traces, and returns HTTP 500.
func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				stack := string(debug.Stack())
				slog.Error("panic_recovered",
					"error", fmt.Sprintf("%v", rec),
					"stack", stack,
					"path", r.URL.Path,
				)

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"error": "Internal server error. Please try again later."}`))
			}
		}()

		next.ServeHTTP(w, r)
	})
}
