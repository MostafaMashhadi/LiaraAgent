package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/block-p/liara-helper-agent/internal/parser"
)

// PGVectorStore implements the VectorStore interface on top of PostgreSQL with the pgvector extension.
type PGVectorStore struct {
	db        *sql.DB
	dimension int
}

// NewPGVectorStore creates a new PGVectorStore and initializes required extensions and tables.
func NewPGVectorStore(db *sql.DB, dimension int) (*PGVectorStore, error) {
	if dimension <= 0 {
		dimension = 1536
	}

	store := &PGVectorStore{
		db:        db,
		dimension: dimension,
	}

	if err := store.InitSchema(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to initialize pgvector schema: %w", err)
	}

	return store, nil
}

// InitSchema sets up the vector extension, tables, and HNSW index.
func (p *PGVectorStore) InitSchema(ctx context.Context) error {
	queries := []string{
		"CREATE EXTENSION IF NOT EXISTS vector;",
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS liara_doc_chunks (
			id VARCHAR(255) PRIMARY KEY,
			file_path TEXT NOT NULL,
			category VARCHAR(64) NOT NULL,
			doc_title TEXT NOT NULL,
			section_title TEXT NOT NULL,
			original_url TEXT NOT NULL,
			raw_body TEXT NOT NULL,
			content TEXT NOT NULL,
			token_estimate INT NOT NULL,
			content_hash VARCHAR(64) NOT NULL,
			embedding vector(%d) NOT NULL
		);`, p.dimension),
		"CREATE INDEX IF NOT EXISTS liara_doc_chunks_embedding_hnsw ON liara_doc_chunks USING hnsw (embedding vector_cosine_ops);",
		"CREATE INDEX IF NOT EXISTS liara_doc_chunks_category_idx ON liara_doc_chunks (category);",
	}

	for _, q := range queries {
		if _, err := p.db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("executing schema query failed [%s]: %w", q, err)
		}
	}

	return nil
}

// Add inserts or updates document chunks in PostgreSQL.
func (p *PGVectorStore) Add(ctx context.Context, chunks []parser.DocumentChunk, embeddings [][]float32) error {
	if len(chunks) != len(embeddings) {
		return fmt.Errorf("chunk count (%d) mismatch embedding count (%d)", len(chunks), len(embeddings))
	}

	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO liara_doc_chunks (
			id, file_path, category, doc_title, section_title, original_url, raw_body, content, token_estimate, content_hash, embedding
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE SET
			doc_title = EXCLUDED.doc_title,
			section_title = EXCLUDED.section_title,
			raw_body = EXCLUDED.raw_body,
			content = EXCLUDED.content,
			content_hash = EXCLUDED.content_hash,
			embedding = EXCLUDED.embedding;
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for i, chunk := range chunks {
		embStr := formatVectorForPG(embeddings[i])
		_, err := stmt.ExecContext(ctx,
			chunk.ID,
			chunk.FilePath,
			chunk.Category,
			chunk.DocTitle,
			chunk.SectionTitle,
			chunk.OriginalURL,
			chunk.RawBody,
			chunk.Content,
			chunk.TokenEstimate,
			"", // content hash
			embStr,
		)
		if err != nil {
			return fmt.Errorf("failed to insert chunk %s: %w", chunk.ID, err)
		}
	}

	return tx.Commit()
}

// Search queries pgvector using cosine distance (<=>).
func (p *PGVectorStore) Search(ctx context.Context, queryVector []float32, opts FilterOptions) ([]SearchResult, error) {
	topK := opts.TopK
	if topK <= 0 {
		topK = 5
	}

	embStr := formatVectorForPG(queryVector)

	query := `
		SELECT 
			id, file_path, category, doc_title, section_title, original_url, raw_body, content, token_estimate,
			1 - (embedding <=> $1) AS score
		FROM liara_doc_chunks
		WHERE ($2 = '' OR category = $2)
		ORDER BY embedding <=> $1
		LIMIT $3;
	`

	rows, err := p.db.QueryContext(ctx, query, embStr, opts.Category, topK)
	if err != nil {
		return nil, fmt.Errorf("pgvector search query failed: %w", err)
	}
	defer rows.Close()

	var results []SearchResult
	for rows.Next() {
		var chunk parser.DocumentChunk
		var score float32

		err := rows.Scan(
			&chunk.ID,
			&chunk.FilePath,
			&chunk.Category,
			&chunk.DocTitle,
			&chunk.SectionTitle,
			&chunk.OriginalURL,
			&chunk.RawBody,
			&chunk.Content,
			&chunk.TokenEstimate,
			&score,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		if score >= opts.MinScore {
			results = append(results, SearchResult{
				Chunk: chunk,
				Score: score,
			})
		}
	}

	return results, nil
}

// Count returns the total number of chunks stored in PostgreSQL.
func (p *PGVectorStore) Count() int {
	var count int
	err := p.db.QueryRow("SELECT COUNT(*) FROM liara_doc_chunks").Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

func (p *PGVectorStore) HasDocument(filePath, contentHash string) bool {
	var count int
	err := p.db.QueryRow("SELECT COUNT(*) FROM liara_doc_chunks WHERE file_path = $1 AND content_hash = $2", filePath, contentHash).Scan(&count)
	return err == nil && count > 0
}

func (p *PGVectorStore) SaveToFile(path string) error {
	// Not applicable for PostgreSQL persistent storage
	return nil
}

func (p *PGVectorStore) LoadFromFile(path string) error {
	// Not applicable for PostgreSQL persistent storage
	return nil
}

func formatVectorForPG(vec []float32) string {
	var sb strings.Builder
	sb.WriteString("[")
	for i, v := range vec {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString(fmt.Sprintf("%f", v))
	}
	sb.WriteString("]")
	return sb.String()
}
