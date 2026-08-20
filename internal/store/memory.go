package store

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/block-p/liara-helper-agent/internal/parser"
)

// VectorEntry stores a chunk along with its embedding vector and metadata.
type VectorEntry struct {
	Chunk     parser.DocumentChunk `json:"chunk"`
	Embedding []float32            `json:"embedding"`
	Norm      float32              `json:"norm"` // Pre-computed Euclidean L2 norm
}

// MemoryStore is a thread-safe in-memory vector & hybrid full-text database.
type MemoryStore struct {
	mu        sync.RWMutex
	entries   []VectorEntry
	docHashes map[string]string // FilePath -> ContentHash
	dimension int
}

// NewMemoryStore initializes an empty in-memory vector store.
func NewMemoryStore(dimension int) *MemoryStore {
	return &MemoryStore{
		entries:   make([]VectorEntry, 0),
		docHashes: make(map[string]string),
		dimension: dimension,
	}
}

// Add adds document chunks and corresponding embedding vectors to the memory store.
func (m *MemoryStore) Add(ctx context.Context, chunks []parser.DocumentChunk, embeddings [][]float32) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	hasEmbeddings := len(embeddings) == len(chunks)

	for i, chunk := range chunks {
		var emb []float32
		var norm float32
		if hasEmbeddings && len(embeddings[i]) > 0 {
			emb = embeddings[i]
			norm = computeNorm(emb)
		}

		entry := VectorEntry{
			Chunk:     chunk,
			Embedding: emb,
			Norm:      norm,
		}
		m.entries = append(m.entries, entry)
	}

	return nil
}

// Search retrieves the top-K chunks using Hybrid Search (Dense Vector + Sparse Keyword Matching).
func (m *MemoryStore) Search(ctx context.Context, queryVector []float32, opts FilterOptions) ([]SearchResult, error) {
	topK := opts.TopK
	if topK <= 0 {
		topK = 5
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.entries) == 0 {
		return nil, nil
	}

	hasQueryVector := len(queryVector) > 0
	var queryNorm float32
	if hasQueryVector {
		queryNorm = computeNorm(queryVector)
	}

	queryKeywords := tokenizeAndNormalize(opts.QueryText)

	var results []SearchResult

	for _, entry := range m.entries {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Category filter
		if opts.Category != "" && entry.Chunk.Category != opts.Category {
			continue
		}

		var vectorScore float32 = 0.0
		if hasQueryVector && len(entry.Embedding) > 0 && queryNorm > 0 && entry.Norm > 0 {
			vectorScore = cosineSimilarity(queryVector, entry.Embedding, queryNorm, entry.Norm)
		}

		var textScore float32 = 0.0
		if len(queryKeywords) > 0 {
			textScore = computeTextRelevance(queryKeywords, entry.Chunk)
		}

		// Hybrid score fusion
		var finalScore float32
		if hasQueryVector && len(entry.Embedding) > 0 && len(queryKeywords) > 0 {
			finalScore = (vectorScore * 0.65) + (textScore * 0.35)
		} else if hasQueryVector && len(entry.Embedding) > 0 {
			finalScore = vectorScore
		} else if len(queryKeywords) > 0 {
			finalScore = textScore
		} else {
			finalScore = 1.0 // Browsing all docs in category or general
		}

		if finalScore < opts.MinScore {
			continue
		}

		results = append(results, SearchResult{
			Chunk: entry.Chunk,
			Score: finalScore,
		})
	}

	// Sort results by score descending
	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if len(results) > topK {
		results = results[:topK]
	}

	return results, nil
}

// GetCategories returns unique category names and chunk counts in the store.
func (m *MemoryStore) GetCategories() map[string]int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	counts := make(map[string]int)
	for _, entry := range m.entries {
		cat := entry.Chunk.Category
		if cat != "" {
			counts[cat]++
		}
	}
	return counts
}

// computeTextRelevance calculates keyword matching relevance score [0.0 - 1.0].
func computeTextRelevance(keywords []string, chunk parser.DocumentChunk) float32 {
	if len(keywords) == 0 {
		return 0
	}

	docTitleNorm := normalizePersian(chunk.DocTitle)
	secTitleNorm := normalizePersian(chunk.SectionTitle)
	bodyNorm := normalizePersian(chunk.RawBody)
	categoryNorm := normalizePersian(chunk.Category)
	pathNorm := normalizePersian(chunk.FilePath)

	var matchedCount float32 = 0.0
	for _, kw := range keywords {
		matched := false
		if strings.Contains(docTitleNorm, kw) {
			matchedCount += 4.0
			matched = true
		}
		if strings.Contains(pathNorm, kw) {
			matchedCount += 3.0
			matched = true
		}
		if strings.Contains(secTitleNorm, kw) {
			matchedCount += 2.5
			matched = true
		}
		if strings.Contains(categoryNorm, kw) {
			matchedCount += 2.0
			matched = true
		}
		if strings.Contains(bodyNorm, kw) {
			matchedCount += 1.0
			matched = true
		}
		if !matched {
			runes := []rune(kw)
			if len(runes) > 3 && strings.Contains(bodyNorm, string(runes[:len(runes)-1])) {
				matchedCount += 0.5
			}
		}
	}

	// Boost main PaaS getting-started and quick-start docs
	if strings.Contains(pathNorm, "getting-started") || strings.Contains(pathNorm, "quick-start") || strings.Contains(pathNorm, "deploy-app") {
		matchedCount += 1.5
	}

	maxPossible := float32(len(keywords)) * 4.5
	score := matchedCount / maxPossible
	if score > 1.0 {
		score = 1.0
	}
	return score
}

// normalizePersian standardizes Arabic/Persian characters for accurate search matching.
func normalizePersian(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, "ي", "ی")
	s = strings.ReplaceAll(s, "ك", "ک")
	s = strings.ReplaceAll(s, "‌", " ") // Zero-width non-joiner
	s = strings.ReplaceAll(s, "ة", "ه")
	s = strings.ReplaceAll(s, "أ", "ا")
	s = strings.ReplaceAll(s, "إ", "ا")
	s = strings.ReplaceAll(s, "آ", "ا")
	return s
}

// stemPersianWord safely strips common Persian grammatical suffixes on rune boundaries.
func stemPersianWord(word string) string {
	runes := []rune(word)
	n := len(runes)
	if n <= 3 {
		return word
	}

	// Strip suffixes like "هایمان", "هایشان", "هایتان"
	if n > 6 && string(runes[n-6:]) == "هایمان" {
		return string(runes[:n-6])
	}
	if n > 4 && (string(runes[n-4:]) == "هایم" || string(runes[n-4:]) == "هایت" || string(runes[n-4:]) == "هایش") {
		return string(runes[:n-4])
	}
	if n > 3 && (string(runes[n-3:]) == "های" || string(runes[n-3:]) == "ترین") {
		return string(runes[:n-3])
	}
	if n > 2 && (string(runes[n-2:]) == "ها" || string(runes[n-2:]) == "تر" || string(runes[n-2:]) == "اش" || string(runes[n-2:]) == "ام" || string(runes[n-2:]) == "ات") {
		return string(runes[:n-2])
	}
	// Strip trailing 'ی' or 'ش' (e.g. "پایتونی" -> "پایتون", "اجراش" -> "اجرا")
	if n > 3 && (runes[n-1] == 'ی' || runes[n-1] == 'ش') {
		return string(runes[:n-1])
	}

	return word
}

var techSynonyms = map[string][]string{
	"پایتون":      {"python", "py", "django", "flask", "fastapi"},
	"python":      {"پایتون", "py", "django", "flask", "fastapi"},
	"نود":         {"node", "nodejs", "npm", "express"},
	"نودجی":       {"node", "nodejs", "npm"},
	"node":        {"نود", "nodejs", "npm", "express"},
	"nodejs":      {"نود", "node", "npm"},
	"لاراول":      {"laravel", "php", "artisan", "composer"},
	"laravel":     {"لاراول", "php", "composer"},
	"جنگو":        {"django", "python", "gunicorn"},
	"django":      {"جنگو", "python", "gunicorn"},
	"فست‌پی‌آی":   {"fastapi", "python", "uvicorn"},
	"fastapi":     {"فست‌پی‌آی", "python", "uvicorn"},
	"فلسک":        {"flask", "python"},
	"flask":       {"فلسک", "python"},
	"داکر":        {"docker", "dockerfile"},
	"docker":      {"داکر", "dockerfile"},
	"استقرار":     {"deploy", "دیپلوی", "اجرا", "start"},
	"دیپلوی":      {"deploy", "استقرار", "اجرا", "start"},
	"deploy":      {"استقرار", "دیپلوی", "اجرا"},
	"اجرا":        {"deploy", "run", "start", "استقرار", "دیپلوی"},
	"نکست":        {"next", "nextjs", "react"},
	"nextjs":      {"نکست", "next", "react"},
	"ری‌اکت":      {"react", "frontend"},
	"react":       {"ری‌اکت", "frontend"},
	"پستگرس":      {"postgres", "postgresql", "psql"},
	"postgres":    {"پستگرس", "postgresql", "دیتابیس"},
	"postgresql":  {"پستگرس", "postgres", "دیتابیس"},
	"ردیس":        {"redis"},
	"redis":       {"ردیس"},
	"مونگو":       {"mongodb", "mongo"},
	"mongodb":     {"مونگو", "mongo"},
	"مای‌اس‌کیوال": {"mysql"},
	"mysql":       {"مای‌اس‌کیوال"},
	"دیتابیس":     {"database", "dbaas", "پایگاه داده"},
	"database":    {"دیتابیس", "dbaas"},
	"استوریج":     {"storage", "s3", "باکت"},
	"storage":     {"استوریج", "s3", "باکت"},
	"کانفیگ":      {"config", "liara.json", "پیکربندی"},
	"config":      {"کانفیگ", "liara.json"},
}

// tokenizeAndNormalize extracts search tokens, performs stemming, and expands tech synonyms.
func tokenizeAndNormalize(text string) []string {
	normalized := normalizePersian(text)
	words := strings.Fields(normalized)

	stopWords := map[string]bool{
		"در": true, "به": true, "از": true, "که": true, "این": true,
		"رو": true, "را": true, "با": true, "است": true, "برای": true,
		"یک": true, "کنم": true, "کنید": true, "چطور": true, "چگونه": true,
		"چیست": true, "آیا": true, "می": true, "شود": true, "کرد": true,
		"من": true, "ما": true, "دارم": true, "میخوام": true, "میخواهم": true,
	}

	seen := make(map[string]bool)
	var tokens []string

	for _, w := range words {
		w = strings.Trim(w, `.,!?:;"'()[]{}/\-`)
		if len(w) >= 2 && !stopWords[w] {
			if !seen[w] {
				seen[w] = true
				tokens = append(tokens, w)
			}

			// Stem the Persian word
			stemmed := stemPersianWord(w)
			if stemmed != w && len(stemmed) >= 2 && !seen[stemmed] {
				seen[stemmed] = true
				tokens = append(tokens, stemmed)
			}

			// Expand tech synonyms
			if syns, exists := techSynonyms[w]; exists {
				for _, syn := range syns {
					if !seen[syn] {
						seen[syn] = true
						tokens = append(tokens, syn)
					}
				}
			}
			if syns, exists := techSynonyms[stemmed]; exists {
				for _, syn := range syns {
					if !seen[syn] {
						seen[syn] = true
						tokens = append(tokens, syn)
					}
				}
			}
		}
	}
	return tokens
}

// Count returns the number of indexed chunks.
func (m *MemoryStore) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.entries)
}

// SetDocumentHash updates the stored hash for a file.
func (m *MemoryStore) SetDocumentHash(filePath, hash string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.docHashes[filePath] = hash
}

// HasDocument returns true if the stored hash matches the current hash.
func (m *MemoryStore) HasDocument(filePath, contentHash string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	storedHash, exists := m.docHashes[filePath]
	return exists && storedHash == contentHash
}

// UpsertDocument updates chunks for a specific file, removing obsolete versions and replacing them.
func (m *MemoryStore) UpsertDocument(ctx context.Context, chunks []parser.DocumentChunk, embeddings [][]float32, filePath, contentHash string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Remove old chunks for this file
	var retained []VectorEntry
	for _, entry := range m.entries {
		if entry.Chunk.FilePath != filePath {
			retained = append(retained, entry)
		}
	}
	m.entries = retained

	// Insert new chunks
	hasEmbeddings := len(embeddings) == len(chunks)
	for i, chunk := range chunks {
		var emb []float32
		var norm float32
		if hasEmbeddings && len(embeddings[i]) > 0 {
			emb = embeddings[i]
			norm = computeNorm(emb)
		}

		entry := VectorEntry{
			Chunk:     chunk,
			Embedding: emb,
			Norm:      norm,
		}
		m.entries = append(m.entries, entry)
	}

	m.docHashes[filePath] = contentHash
}

// RemoveDocument deletes all chunks associated with a file path.
func (m *MemoryStore) RemoveDocument(filePath string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var retained []VectorEntry
	for _, entry := range m.entries {
		if entry.Chunk.FilePath != filePath {
			retained = append(retained, entry)
		}
	}
	m.entries = retained
	delete(m.docHashes, filePath)
}

// GetAllTrackedFiles returns a copy of tracked file paths and their hashes.
func (m *MemoryStore) GetAllTrackedFiles() map[string]string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	res := make(map[string]string, len(m.docHashes))
	for k, v := range m.docHashes {
		res[k] = v
	}
	return res
}

type serializedData struct {
	Entries   []VectorEntry     `json:"entries"`
	DocHashes map[string]string `json:"doc_hashes"`
	Dimension int               `json:"dimension"`
}

// SaveToFile exports the memory store to a JSON file on disk.
func (m *MemoryStore) SaveToFile(path string) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	data := serializedData{
		Entries:   m.entries,
		DocHashes: m.docHashes,
		Dimension: m.dimension,
	}

	fileBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal vector store: %w", err)
	}

	if err := os.WriteFile(path, fileBytes, 0644); err != nil {
		return fmt.Errorf("failed to write vector store to file: %w", err)
	}

	return nil
}

// LoadFromFile restores the memory store from a saved JSON file.
func (m *MemoryStore) LoadFromFile(path string) error {
	fileBytes, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	var data serializedData
	if err := json.Unmarshal(fileBytes, &data); err != nil {
		return fmt.Errorf("failed to unmarshal vector store: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.entries = data.Entries
	m.docHashes = data.DocHashes
	m.dimension = data.Dimension

	// Recompute norms if missing
	for i := range m.entries {
		if m.entries[i].Norm == 0 && len(m.entries[i].Embedding) > 0 {
			m.entries[i].Norm = computeNorm(m.entries[i].Embedding)
		}
	}

	return nil
}

// computeNorm calculates the Euclidean L2 norm: sqrt(sum(v_i^2))
func computeNorm(vec []float32) float32 {
	var sum float64
	for _, val := range vec {
		sum += float64(val) * float64(val)
	}
	return float32(math.Sqrt(sum))
}

// cosineSimilarity calculates dot(a, b) / (norm(a) * norm(b))
func cosineSimilarity(a, b []float32, normA, normB float32) float32 {
	if normA == 0 || normB == 0 {
		return 0
	}
	if len(a) != len(b) {
		return 0
	}

	var dot float64
	for i := 0; i < len(a); i++ {
		dot += float64(a[i]) * float64(b[i])
	}

	sim := float32(dot) / (normA * normB)
	if sim > 1.0 {
		return 1.0
	}
	if sim < -1.0 {
		return -1.0
	}
	return sim
}
