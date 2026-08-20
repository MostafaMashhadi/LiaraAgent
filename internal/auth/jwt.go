package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type contextKey string

const (
	// UserContextKey is the context key for authenticated user claims.
	UserContextKey contextKey = "auth_user_claims"
)

// Claims represents the JWT payload.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	Role   string `json:"role"` // "admin" or "user"
	jwt.RegisteredClaims
}

// GenerateToken creates a signed JWT token for a user.
func GenerateToken(userID, email, name, role, secret string, duration time.Duration) (string, error) {
	if duration <= 0 {
		duration = 7 * 24 * time.Hour // Default 7 days
	}

	claims := Claims{
		UserID: userID,
		Email:  email,
		Name:   name,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "liara-helper-agent",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return signed, nil
}

// ValidateToken parses and validates a JWT token string.
func ValidateToken(tokenString, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}

// CheckPassword verifies a plaintext password against a bcrypt hash.
func CheckPassword(hashedPassword, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}

// ExtractTokenFromRequest retrieves Bearer token from header or query string.
func ExtractTokenFromRequest(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}
	if cookie, err := r.Cookie("token"); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	if qToken := r.URL.Query().Get("token"); qToken != "" {
		return qToken
	}
	return ""
}

// AuthMiddleware extracts JWT token and injects claims into context if present.
func AuthMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := ExtractTokenFromRequest(r)
			if tokenStr != "" {
				claims, err := ValidateToken(tokenStr, secret)
				if err == nil && claims != nil {
					ctx := context.WithValue(r.Context(), UserContextKey, claims)
					r = r.WithContext(ctx)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// GetClaims retrieves Claims from request context.
func GetClaims(ctx context.Context) *Claims {
	if val := ctx.Value(UserContextKey); val != nil {
		if claims, ok := val.(*Claims); ok {
			return claims
		}
	}
	return nil
}

// RequireAuth middleware ensures the request has a valid authenticated user.
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims := GetClaims(r.Context())
		if claims == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"برای دسترسی به این بخش لطفاً وارد حساب کاربری شوید"}`))
			return
		}
		next.ServeHTTP(w, r)
	}
}

// RequireAdmin middleware ensures the user has 'admin' role.
func RequireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims := GetClaims(r.Context())
		if claims == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"احراز هویت الزامی است"}`))
			return
		}
		if claims.Role != "admin" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"error":"دسترسی غیرمجاز: نیاز به سطح دسترسی مدیر سیستم (Admin)"}`))
			return
		}
		next.ServeHTTP(w, r)
	}
}
