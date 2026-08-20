package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestGenerateAndValidateToken(t *testing.T) {
	secret := "test-secret-key-12345"
	userID := "usr_test123"
	email := "test@liara.ir"
	name := "تست کاربر"
	role := "admin"

	token, err := GenerateToken(userID, email, name, role, secret, 1*time.Hour)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	if token == "" {
		t.Fatal("generated token is empty")
	}

	claims, err := ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("failed to validate token: %v", err)
	}

	if claims.UserID != userID || claims.Email != email || claims.Role != role {
		t.Errorf("claims mismatch: got %+v", claims)
	}
}

func TestPasswordHashingAndCheck(t *testing.T) {
	password := "SecretPass2026!"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	if !CheckPassword(string(hash), password) {
		t.Error("expected password check to succeed")
	}

	if CheckPassword(string(hash), "WrongPassword") {
		t.Error("expected password check to fail for incorrect password")
	}
}

func TestRequireAdminMiddleware(t *testing.T) {
	secret := "test-secret-key"

	adminToken, _ := GenerateToken("adm_1", "admin@liara.ir", "Admin", "admin", secret, time.Hour)
	userToken, _ := GenerateToken("usr_1", "user@liara.ir", "User", "user", secret, time.Hour)

	handler := AuthMiddleware(secret)(
		RequireAdmin(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
		}),
	)

	// Case 1: No auth -> 401
	reqNoAuth := httptest.NewRequest("GET", "/api/admin/logs", nil)
	rrNoAuth := httptest.NewRecorder()
	handler.ServeHTTP(rrNoAuth, reqNoAuth)
	if rrNoAuth.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", rrNoAuth.Code)
	}

	// Case 2: Regular user -> 403 Forbidden
	reqUser := httptest.NewRequest("GET", "/api/admin/logs", nil)
	reqUser.Header.Set("Authorization", "Bearer "+userToken)
	rrUser := httptest.NewRecorder()
	handler.ServeHTTP(rrUser, reqUser)
	if rrUser.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden, got %d", rrUser.Code)
	}

	// Case 3: Admin user -> 200 OK
	reqAdmin := httptest.NewRequest("GET", "/api/admin/logs", nil)
	reqAdmin.Header.Set("Authorization", "Bearer "+adminToken)
	rrAdmin := httptest.NewRecorder()
	handler.ServeHTTP(rrAdmin, reqAdmin)
	if rrAdmin.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", rrAdmin.Code)
	}
}
