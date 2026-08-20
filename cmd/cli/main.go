package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/block-p/liara-helper-agent/internal/config"
	"github.com/block-p/liara-helper-agent/internal/parser"
	"github.com/block-p/liara-helper-agent/internal/rag"
	"github.com/block-p/liara-helper-agent/internal/store"
	"github.com/block-p/liara-helper-agent/pkg/llm"
)

func main() {
	docsDir := flag.String("docs", "", "Path to Liara documentation markdown directory")
	indexPath := flag.String("index-path", "", "Path to saved vector index file")
	doReindex := flag.Bool("reindex", false, "Force re-indexing of all documentation files")
	query := flag.String("ask", "", "Ask a single question and exit")
	category := flag.String("category", "", "Filter query by category (e.g. paas, dbaas, ai)")
	flag.Parse()

	cfg := config.LoadConfig()
	if *docsDir != "" {
		cfg.DocsDir = *docsDir
	}
	if *indexPath != "" {
		cfg.IndexPath = *indexPath
	}

	memStore := store.NewMemoryStore(cfg.EmbeddingDim)

	// Initialize LLM Client
	llmClient := llm.NewClient(llm.Config{
		APIKey:         cfg.APIKey,
		BaseURL:        cfg.BaseURL,
		ChatModel:      cfg.ChatModel,
		EmbeddingModel: cfg.EmbeddingModel,
		ProxyURL:       cfg.ProxyURL,
	})

	if *doReindex {
		_ = os.Remove(cfg.IndexPath)
	}

	if cfg.APIKey == "" {
		fmt.Println("⚠️  LLM_API_KEY is not set. Testing in offline ingestion/parsing mode.")
		fmt.Println("💡 To generate embeddings and ask questions, set LLM_API_KEY in your .env file.")
		runParserInspection(cfg.DocsDir)
		return
	}

	initCtx, initCancel := context.WithTimeout(context.Background(), 10*time.Minute)
	if err := store.EnsureIndex(initCtx, cfg.DocsDir, cfg.IndexPath, cfg.EmbeddingDim, memStore, llmClient); err != nil {
		log.Fatalf("Vector store index initialization failed: %v", err)
	}
	initCancel()

	ragEngine := rag.NewEngine(memStore, llmClient)

	// If a single question is provided via flag
	if *query != "" {
		executeQuestion(ragEngine, *query, *category)
		return
	}

	// Interactive REPL Mode
	startREPL(ragEngine, *category)
}

func executeQuestion(engine *rag.Engine, question, category string) {
	fmt.Printf("\n❓ Question: %s\n", question)
	if category != "" {
		fmt.Printf("🏷️ Category: %s\n", category)
	}
	fmt.Println("⏳ Searching knowledge base & generating answer...")

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	resp, err := engine.Query(ctx, question, rag.QueryOptions{
		Category: category,
		TopK:     4,
	})
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		return
	}

	fmt.Println("\n========================= 🤖 LIARA AI ASSISTANT =========================")
	fmt.Println(resp.Answer)
	fmt.Println("=========================================================================")

	if len(resp.Sources) > 0 {
		fmt.Println("\n🔗 Verified Doc Sources:")
		for i, src := range resp.Sources {
			fmt.Printf("  [%d] %s -> %s (Score: %.2f)\n", i+1, src.Title, src.URL, src.Score)
		}
	}
	fmt.Printf("\n⏱️ Response Time: %v\n", resp.Duration)
}

func startREPL(engine *rag.Engine, category string) {
	fmt.Println("=======================================================")
	fmt.Println("🚀 Liara AI Helper Agent - Interactive CLI")
	fmt.Println("Type your question and press Enter. Type 'exit' to quit.")
	fmt.Println("=======================================================")

	scanner := bufio.NewScanner(os.Stdin)
	for {
		fmt.Print("\n💬 You: ")
		if !scanner.Scan() {
			break
		}

		input := strings.TrimSpace(scanner.Text())
		if input == "" {
			continue
		}
		if strings.EqualFold(input, "exit") || strings.EqualFold(input, "quit") {
			fmt.Println("👋 Goodbye!")
			break
		}

		executeQuestion(engine, input, category)
	}
}

func runParserInspection(docsDir string) {
	p := parser.NewParser(2500, 200)
	engine := parser.NewIngestionEngine(p)
	result, err := engine.IngestDirectory(docsDir)
	if err != nil {
		log.Fatalf("Failed to ingest documentation: %v", err)
	}

	fmt.Println("==================================================")
	fmt.Println("🎉 Ingestion & Semantic Chunking Completed!")
	fmt.Println("==================================================")
	fmt.Printf("📄 Total Markdown Files:  %d\n", result.TotalFiles)
	fmt.Printf("🧩 Total Semantic Chunks: %d\n", result.TotalChunks)
	fmt.Printf("🪙 Estimated Total Tokens:%d\n", result.TotalTokens)
	fmt.Printf("🏷️  Categories Found:      %s\n", strings.Join(result.CategoriesSeen, ", "))
	fmt.Println("==================================================")
}
