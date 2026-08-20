package tools

import (
	"context"
	"strings"
	"testing"
)

func TestConfigGeneratorTool(t *testing.T) {
	tool := NewConfigGeneratorTool()

	ctx := context.Background()

	// Test Node.js config generation
	res, err := tool.Execute(ctx, `{"platform": "node", "app_name": "test-node", "port": 3000}`)
	if err != nil {
		t.Fatalf("config tool execution failed: %v", err)
	}

	if !res.Success {
		t.Errorf("expected success to be true")
	}

	if !strings.Contains(res.Data, `"platform": "node"`) {
		t.Errorf("expected generated json to contain node platform")
	}

	if !strings.Contains(res.Data, `"app": "test-node"`) {
		t.Errorf("expected generated json to contain app name")
	}

	if !strings.Contains(res.Data, "liara deploy") {
		t.Errorf("expected output to contain deploy command")
	}
}

func TestErrorLogAnalyzerTool(t *testing.T) {
	tool := NewErrorLogAnalyzerTool()
	ctx := context.Background()

	sampleLog := `
npm ERR! missing script: "start"
npm ERR! A complete log of this run can be found in:
npm ERR!     /root/.npm/_logs/2026-08-20T00_00_00_000Z-debug.log
`

	res, err := tool.Execute(ctx, sampleLog)
	if err != nil {
		t.Fatalf("log analyzer failed: %v", err)
	}

	if !res.Success {
		t.Errorf("expected success true")
	}

	if !strings.Contains(res.Data, "عدم وجود اسکریپت start") {
		t.Errorf("expected diagnosis for missing start script")
	}

	if !strings.Contains(res.Data, "node server.js") {
		t.Errorf("expected solution to contain start script recommendation")
	}
}
