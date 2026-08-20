package parser

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

// IngestionResult summarizes the result of processing a documentation directory.
type IngestionResult struct {
	TotalFiles     int         `json:"total_files"`
	TotalChunks    int         `json:"total_chunks"`
	TotalTokens    int         `json:"total_tokens"`
	Documents      []*Document `json:"documents"`
	CategoriesSeen []string    `json:"categories_seen"`
	Errors         []string    `json:"errors,omitempty"`
}

// IngestionEngine orchestrates walking directories and parsing markdown files concurrently.
type IngestionEngine struct {
	Parser  *Parser
	Workers int
}

// NewIngestionEngine creates a new IngestionEngine with an optimal worker count.
func NewIngestionEngine(p *Parser) *IngestionEngine {
	if p == nil {
		p = NewParser(0, 0)
	}
	workers := runtime.NumCPU() * 2
	if workers < 4 {
		workers = 4
	}
	return &IngestionEngine{
		Parser:  p,
		Workers: workers,
	}
}

// IngestDirectory walks a directory, discovers all .md / .mdx files, and parses them concurrently.
func (e *IngestionEngine) IngestDirectory(dirPath string) (*IngestionResult, error) {
	info, err := os.Stat(dirPath)
	if err != nil {
		return nil, fmt.Errorf("invalid directory %s: %w", dirPath, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("path is not a directory: %s", dirPath)
	}

	var files []string
	err = filepath.WalkDir(dirPath, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			// Skip hidden or system folders
			name := d.Name()
			if strings.HasPrefix(name, ".") || name == "node_modules" {
				return filepath.SkipDir
			}
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".md" || ext == ".mdx" {
			// Skip README if it's the top level repo readme and not documentation
			if strings.EqualFold(d.Name(), "README.md") && path == filepath.Join(dirPath, "README.md") {
				return nil
			}
			files = append(files, path)
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk directory: %w", err)
	}

	// Channel pipeline for concurrent parsing
	fileChan := make(chan string, len(files))
	resultChan := make(chan *Document, len(files))
	errChan := make(chan string, len(files))

	var wg sync.WaitGroup
	for w := 0; w < e.Workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for file := range fileChan {
				doc, parseErr := e.Parser.ParseFile(file, dirPath)
				if parseErr != nil {
					errChan <- fmt.Sprintf("file %s: %v", file, parseErr)
					continue
				}
				resultChan <- doc
			}
		}()
	}

	for _, file := range files {
		fileChan <- file
	}
	close(fileChan)

	wg.Wait()
	close(resultChan)
	close(errChan)

	res := &IngestionResult{
		TotalFiles: len(files),
	}

	categoryMap := make(map[string]struct{})
	for doc := range resultChan {
		res.Documents = append(res.Documents, doc)
		res.TotalChunks += len(doc.Chunks)
		for _, c := range doc.Chunks {
			res.TotalTokens += c.TokenEstimate
		}
		if doc.Category != "" {
			categoryMap[doc.Category] = struct{}{}
		}
	}

	for errStr := range errChan {
		res.Errors = append(res.Errors, errStr)
	}

	for cat := range categoryMap {
		res.CategoriesSeen = append(res.CategoriesSeen, cat)
	}

	return res, nil
}
