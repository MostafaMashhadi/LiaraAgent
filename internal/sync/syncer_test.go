package syncer

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"

	"github.com/block-p/liara-helper-agent/internal/store"
)

func TestVerifySignature(t *testing.T) {
	secret := "my-secret-webhook-key"
	payload := []byte(`{"ref": "refs/heads/main", "commits": []}`)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedSig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	s := NewSyncer("", "", "", secret, nil, nil)

	if !s.VerifySignature(payload, expectedSig) {
		t.Errorf("expected valid signature to pass verification")
	}

	if s.VerifySignature(payload, "sha256=invalid_signature") {
		t.Errorf("expected invalid signature to fail verification")
	}
}

func TestIncrementalSync(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "sync-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	docsDir := filepath.Join(tmpDir, "docs")
	_ = os.MkdirAll(docsDir, 0755)

	indexPath := filepath.Join(tmpDir, "index.json")

	file1 := filepath.Join(docsDir, "test1.md")
	_ = os.WriteFile(file1, []byte("# Doc 1\n\nInitial content"), 0644)

	memStore := store.NewMemoryStore(3)
	s := NewSyncer("", docsDir, indexPath, "", memStore, nil)

	ctx := context.Background()

	// Initial sync
	rep1, err := s.Sync(ctx)
	if err != nil {
		t.Fatalf("sync 1 failed: %v", err)
	}

	if rep1.FilesAdded != 1 {
		t.Errorf("expected 1 file added, got %d", rep1.FilesAdded)
	}

	// Second sync with no changes (should detect 0 modifications and save tokens)
	rep2, err := s.Sync(ctx)
	if err != nil {
		t.Fatalf("sync 2 failed: %v", err)
	}

	if rep2.FilesModified != 0 || rep2.FilesAdded != 0 {
		t.Errorf("expected 0 files modified or added in second sync, got %+v", rep2)
	}

	if rep2.SavedTokens == 0 {
		t.Errorf("expected token savings to be recorded")
	}

	// Modify file1
	_ = os.WriteFile(file1, []byte("# Doc 1\n\nUpdated content with new section\n\n## Section 2\nDetails"), 0644)

	rep3, err := s.Sync(ctx)
	if err != nil {
		t.Fatalf("sync 3 failed: %v", err)
	}

	if rep3.FilesModified != 1 {
		t.Errorf("expected 1 file modified in sync 3, got %d", rep3.FilesModified)
	}
}
