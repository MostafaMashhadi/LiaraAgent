package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// ConfigGeneratorTool generates valid liara.json configuration and Dockerfile templates.
type ConfigGeneratorTool struct{}

// NewConfigGeneratorTool creates a new instance of ConfigGeneratorTool.
func NewConfigGeneratorTool() *ConfigGeneratorTool {
	return &ConfigGeneratorTool{}
}

func (t *ConfigGeneratorTool) Name() string {
	return "generate_liara_config"
}

func (t *ConfigGeneratorTool) Description() string {
	return "Generates valid liara.json configurations and Dockerfile templates for Liara Cloud platforms (Node.js, Python, Go, PHP/Laravel, Docker, Next.js, Django, etc.)."
}

func (t *ConfigGeneratorTool) ParametersJSONSchema() string {
	return `{
		"type": "object",
		"properties": {
			"platform": {
				"type": "string",
				"enum": ["node", "next", "python", "django", "flask", "fastapi", "go", "php", "laravel", "docker", "static", "wordpress"],
				"description": "The target Liara application platform"
			},
			"app_name": {
				"type": "string",
				"description": "The unique application name on Liara"
			},
			"port": {
				"type": "integer",
				"description": "The application listening port (e.g. 3000, 8000, 8080)"
			},
			"disks": {
				"type": "array",
				"items": {
					"type": "object",
					"properties": {
						"name": {"type": "string"},
						"mountTo": {"type": "string"}
					}
				},
				"description": "Persistent disk mount configurations"
			}
		},
		"required": ["platform"]
	}`
}

// ConfigRequest input parameters for generation.
type ConfigRequest struct {
	Platform string `json:"platform"`
	AppName  string `json:"app_name,omitempty"`
	Port     int    `json:"port,omitempty"`
	Cron     string `json:"cron,omitempty"`
	Disks    []struct {
		Name    string `json:"name"`
		MountTo string `json:"mountTo"`
	} `json:"disks,omitempty"`
}

// Execute generates the liara.json file contents and instructions.
func (t *ConfigGeneratorTool) Execute(ctx context.Context, input string) (*ToolResult, error) {
	var req ConfigRequest
	if err := json.Unmarshal([]byte(input), &req); err != nil {
		// Fallback: try parsing input as a raw platform name string
		req.Platform = strings.ToLower(strings.TrimSpace(input))
	}

	platform := strings.ToLower(strings.TrimSpace(req.Platform))
	if req.AppName == "" {
		req.AppName = "my-app"
	}

	var configMap map[string]interface{}
	var extraInstructions string

	switch platform {
	case "node", "nodejs":
		if req.Port == 0 {
			req.Port = 3000
		}
		configMap = map[string]interface{}{
			"platform": "node",
			"app":      req.AppName,
			"port":     req.Port,
		}
		extraInstructions = "نکته: اطمینان حاصل کنید اسکریپت `start` در فایل `package.json` تعریف شده باشد:\n```json\n\"scripts\": {\n  \"start\": \"node server.js\"\n}\n```"

	case "next", "nextjs":
		if req.Port == 0 {
			req.Port = 3000
		}
		configMap = map[string]interface{}{
			"platform": "next",
			"app":      req.AppName,
			"port":     req.Port,
		}
		extraInstructions = "نکته: در فایل `next.config.js` گزینه `output: 'standalone'` را جهت بهینه‌سازی حجم ایمیج فعال کنید."

	case "python", "flask", "fastapi":
		if req.Port == 0 {
			req.Port = 8000
		}
		configMap = map[string]interface{}{
			"platform": "python",
			"app":      req.AppName,
			"port":     req.Port,
		}
		extraInstructions = "نکته: فایل `requirements.txt` را در ریشه پروژه قرار داده و وب‌سرور مانند Gunicorn یا Uvicorn را در آن مشخص کنید."

	case "django":
		if req.Port == 0 {
			req.Port = 8000
		}
		configMap = map[string]interface{}{
			"platform": "django",
			"app":      req.AppName,
			"port":     req.Port,
			"django": map[string]interface{}{
				"settingsFile": fmt.Sprintf("%s.settings", req.AppName),
			},
		}
		extraInstructions = "نکته: برای جمع‌آوری فایل‌های استاتیک، دستور `python manage.py collectstatic` به صورت خودکار توسط لیارا اجرا می‌شود."

	case "go", "golang":
		if req.Port == 0 {
			req.Port = 8080
		}
		configMap = map[string]interface{}{
			"platform": "go",
			"app":      req.AppName,
			"port":     req.Port,
		}
		extraInstructions = "نکته: برنامه Go باید به پورت مشخص‌شده گوش داده (`0.0.0.0:8080`) و فایل `go.mod` در ریشه قرار داشته باشد."

	case "laravel", "php":
		if req.Port == 0 {
			req.Port = 80
		}
		configMap = map[string]interface{}{
			"platform": "laravel",
			"app":      req.AppName,
			"port":     req.Port,
		}
		extraInstructions = "نکته: متغیرهای محیطی لاراول مانند `APP_KEY`, `DB_HOST`, `DB_DATABASE` را در بخش متغیرهای کنسول لیارا ثبت کنید."

	case "docker":
		if req.Port == 0 {
			req.Port = 80
		}
		configMap = map[string]interface{}{
			"platform": "docker",
			"app":      req.AppName,
			"port":     req.Port,
		}
		extraInstructions = "نکته: فایل `Dockerfile` و `.dockerignore` باید در مسیر اصلی پروژه قرار داشته باشند."

	case "static":
		if req.Port == 0 {
			req.Port = 80
		}
		configMap = map[string]interface{}{
			"platform": "static",
			"app":      req.AppName,
			"port":     req.Port,
		}
		extraInstructions = "نکته: فایل اصلی `index.html` باید در مسیر ریشه پوشه پروژه قرار داشته باشد."

	default:
		if req.Port == 0 {
			req.Port = 8080
		}
		configMap = map[string]interface{}{
			"platform": platform,
			"app":      req.AppName,
			"port":     req.Port,
		}
	}

	if len(req.Disks) > 0 {
		configMap["disks"] = req.Disks
	}

	jsonBytes, err := json.MarshalIndent(configMap, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to generate liara.json: %w", err)
	}

	output := fmt.Sprintf("```json\n%s\n```\n\n%s\n\n**دستور دیپلوی:**\n```bash\nliara deploy\n```", string(jsonBytes), extraInstructions)

	return &ToolResult{
		Success: true,
		Data:    output,
		Meta: map[string]interface{}{
			"platform": platform,
			"config":   configMap,
		},
	}, nil
}
