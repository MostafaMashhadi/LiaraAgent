package syncer

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/block-p/liara-helper-agent/internal/parser"
	"github.com/block-p/liara-helper-agent/internal/store"
	"github.com/block-p/liara-helper-agent/pkg/llm"
)

// SyncReport summarizes the results of an incremental document sync.
type SyncReport struct {
	FilesAdded       int           `json:"files_added"`
	FilesModified    int           `json:"files_modified"`
	FilesDeleted     int           `json:"files_deleted"`
	ChunksVectorized int           `json:"chunks_vectorized"`
	TotalChunksNow   int           `json:"total_chunks_now"`
	Duration         time.Duration `json:"duration_ms"`
	SavedTokens      int           `json:"saved_tokens"`
}

// Syncer handles incremental git pulling and change-based vectorization.
type Syncer struct {
	RepoDir       string
	DocsDir       string
	IndexPath     string
	WebhookSecret string
	Store         *store.MemoryStore
	LLMClient     *llm.Client
	Parser        *parser.Parser
}

// NewSyncer creates a new Syncer instance.
func NewSyncer(repoDir, docsDir, indexPath, webhookSecret string, st *store.MemoryStore, client *llm.Client) *Syncer {
	return &Syncer{
		RepoDir:       repoDir,
		DocsDir:       docsDir,
		IndexPath:     indexPath,
		WebhookSecret: webhookSecret,
		Store:         st,
		LLMClient:     client,
		Parser:        parser.NewParser(0, 0),
	}
}

// VerifySignature validates GitHub's HMAC-SHA256 signature (X-Hub-Signature-256 header).
func (s *Syncer) VerifySignature(payload []byte, signatureHeader string) bool {
	if s.WebhookSecret == "" {
		return true // If no secret is configured, accept (optional development mode)
	}

	if !strings.HasPrefix(signatureHeader, "sha256=") {
		return false
	}
	expectedSig := signatureHeader[7:]

	mac := hmac.New(sha256.New, []byte(s.WebhookSecret))
	mac.Write(payload)
	actualSig := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(actualSig), []byte(expectedSig))
}

// Sync performs incremental pull and updates vectors for ONLY changed or added files (Low Usage / High Cost Optimization).
func (s *Syncer) Sync(ctx context.Context) (*SyncReport, error) {
	startTime := time.Now()
	report := &SyncReport{}

	// 1. Git pull latest changes from GitHub if repoDir exists
	if s.RepoDir != "" {
		if _, err := os.Stat(filepath.Join(s.RepoDir, ".git")); err == nil {
			slog.Info("pulling latest docs from git repository...", "repo_dir", s.RepoDir)
			cmd := exec.CommandContext(ctx, "git", "-C", s.RepoDir, "pull", "--ff-only")
			out, err := cmd.CombinedOutput()
			if err != nil {
				slog.Warn("git pull warning", "error", err, "output", string(out))
			} else {
				slog.Info("git pull completed", "output", strings.TrimSpace(string(out)))
			}
		}
	}

	// 2. Discover all current markdown files
	currentFiles := make(map[string]string) // relPath -> absPath
	err := filepath.WalkDir(s.DocsDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".md" || ext == ".mdx" {
			rel, _ := filepath.Rel(s.DocsDir, path)
			currentFiles[rel] = path
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to walk docs dir: %w", err)
	}

	trackedFiles := s.Store.GetAllTrackedFiles()

	var filesToUpdate []*parser.Document
	var textsToEmbed []string
	var chunksToEmbed []parser.DocumentChunk

	// 3. Detect added and modified files via SHA-256 hash comparison
	for relPath, absPath := range currentFiles {
		doc, err := s.Parser.ParseFile(absPath, s.DocsDir)
		if err != nil {
			slog.Warn("failed to parse file during sync", "file", relPath, "error", err)
			continue
		}

		oldHash, tracked := trackedFiles[relPath]
		if !tracked {
			report.FilesAdded++
			filesToUpdate = append(filesToUpdate, doc)
			for _, ch := range doc.Chunks {
				chunksToEmbed = append(chunksToEmbed, ch)
				textsToEmbed = append(textsToEmbed, ch.Content)
			}
		} else if oldHash != doc.ContentHash {
			report.FilesModified++
			filesToUpdate = append(filesToUpdate, doc)
			for _, ch := range doc.Chunks {
				chunksToEmbed = append(chunksToEmbed, ch)
				textsToEmbed = append(textsToEmbed, ch.Content)
			}
		} else {
			// File is unchanged! Token savings!
			report.SavedTokens += (len(doc.Chunks) * 200)
		}
	}

	// 4. Detect deleted files
	for trackedPath := range trackedFiles {
		if _, exists := currentFiles[trackedPath]; !exists {
			report.FilesDeleted++
			s.Store.RemoveDocument(trackedPath)
			slog.Info("removed deleted doc from vector store", "file", trackedPath)
		}
	}

	// 5. Generate embeddings only for added/modified chunks (Low Token Consumption)
	if len(chunksToEmbed) > 0 {
		slog.Info("vectorizing changed chunks...", "chunks", len(chunksToEmbed))
		var embeddings [][]float32

		if s.LLMClient != nil && s.LLMClient.APIKey != "" {
			var err error
			embeddings, err = s.LLMClient.CreateBatchEmbeddings(ctx, textsToEmbed)
			if err != nil {
				slog.Error("failed to generate embeddings for updated chunks", "error", err)
				// Still update text in memory store for keyword search
			}
		}

		// Map generated embeddings back to documents
		embIdx := 0
		for _, doc := range filesToUpdate {
			docChunksCount := len(doc.Chunks)
			var docEmbeddings [][]float32
			if len(embeddings) >= embIdx+docChunksCount {
				docEmbeddings = embeddings[embIdx : embIdx+docChunksCount]
			}
			embIdx += docChunksCount

			relPath, _ := filepath.Rel(s.DocsDir, doc.FilePath)
			s.Store.UpsertDocument(ctx, doc.Chunks, docEmbeddings, relPath, doc.ContentHash)
		}

		report.ChunksVectorized = len(chunksToEmbed)
	}

	report.TotalChunksNow = s.Store.Count()
	report.Duration = time.Since(startTime)

	// 6. Save updated index to disk
	if (report.FilesAdded > 0 || report.FilesModified > 0 || report.FilesDeleted > 0) && s.IndexPath != "" {
		if err := s.Store.SaveToFile(s.IndexPath); err != nil {
			slog.Warn("failed to save updated vector store to disk", "error", err)
		} else {
			slog.Info("saved updated vector index to disk", "path", s.IndexPath)
		}
	}

	slog.Info("incremental sync finished",
		"added", report.FilesAdded,
		"modified", report.FilesModified,
		"deleted", report.FilesDeleted,
		"vectorized", report.ChunksVectorized,
		"duration", report.Duration,
	)

	return report, nil
}
