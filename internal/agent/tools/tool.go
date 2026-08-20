package tools

import (
	"context"
)

// Tool represents an executable actionable tool available to the AI agent.
type Tool interface {
	Name() string
	Description() string
	ParametersJSONSchema() string
	Execute(ctx context.Context, input string) (*ToolResult, error)
}

// ToolResult contains the output of a tool execution.
type ToolResult struct {
	Success bool                   `json:"success"`
	Data    string                 `json:"data"`
	Meta    map[string]interface{} `json:"meta,omitempty"`
}
