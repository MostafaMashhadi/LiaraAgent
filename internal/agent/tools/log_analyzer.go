package tools

import (
	"context"
	"fmt"
	"strings"
)

// ErrorLogAnalyzerTool diagnoses application build/deployment/runtime errors on Liara.
type ErrorLogAnalyzerTool struct{}

// NewErrorLogAnalyzerTool creates a new ErrorLogAnalyzerTool instance.
func NewErrorLogAnalyzerTool() *ErrorLogAnalyzerTool {
	return &ErrorLogAnalyzerTool{}
}

func (t *ErrorLogAnalyzerTool) Name() string {
	return "analyze_error_log"
}

func (t *ErrorLogAnalyzerTool) Description() string {
	return "Analyzes build, deployment, or runtime error logs from Liara Cloud and suggests exact actionable fixes."
}

func (t *ErrorLogAnalyzerTool) ParametersJSONSchema() string {
	return `{
		"type": "object",
		"properties": {
			"log": {
				"type": "string",
				"description": "The raw error log text to diagnose"
			}
		},
		"required": ["log"]
	}`
}

type Diagnosis struct {
	ErrorType string
	Cause     string
	Solution  string
}

// Execute diagnoses the log text and returns structured remediation steps.
func (t *ErrorLogAnalyzerTool) Execute(ctx context.Context, input string) (*ToolResult, error) {
	logText := strings.ToLower(input)

	var diagnoses []Diagnosis

	// 1. Missing start script in Node.js
	if strings.Contains(logText, "missing script: \"start\"") || strings.Contains(logText, "npm err! missing script: start") {
		diagnoses = append(diagnoses, Diagnosis{
			ErrorType: "عدم وجود اسکریپت start در Node.js",
			Cause:     "لیارا برای اجرای برنامه‌های Node.js از دستور npm start استفاده می‌کند، اما این اسکریپت در package.json یافت نشد.",
			Solution:  "در فایل `package.json` بخش `scripts` را به شکل زیر تکمیل کنید:\n```json\n\"scripts\": {\n  \"start\": \"node server.js\"\n}\n```",
		})
	}

	// 2. Node.js JavaScript heap out of memory
	if strings.Contains(logText, "javascript heap out of memory") || strings.Contains(logText, "fatal error: runtime: out of memory") {
		diagnoses = append(diagnoses, Diagnosis{
			ErrorType: "کمبود حافظه RAM (Out of Memory)",
			Cause:     "فرایند Build یا اجرای برنامه به حافظه بیشتری از پلن فعلی نیاز دارد.",
			Solution:  "۱. پلن برنامه خود را در کنسول لیارا به رم بالاتر ارتقا دهید.\n۲. یا در `package.json` متغیر Node را افزایش دهید:\n```json\n\"scripts\": {\n  \"build\": \"NODE_OPTIONS=--max-old-space-size=2048 next build\"\n}\n```",
		})
	}

	// 3. Database Connection Refused
	if strings.Contains(logText, "econnrefused") || strings.Contains(logText, "connection refused") || strings.Contains(logText, "could not connect to server") {
		diagnoses = append(diagnoses, Diagnosis{
			ErrorType: "خطای عدم اتصال به دیتابیس (Connection Refused)",
			Cause:     "برنامه نمی‌تواند به هاست یا پورت دیتابیس متصل شود (احتمال اشتباه بودن DB_HOST، پورت یا خاموش بودن دیتابیس).",
			Solution:  "۱. مطمئن شوید دیتابیس در کنسول لیارا روشن است.\n۲. نام هاست داخلی (Internal Host) و پورت دیتابیس را در متغیرهای محیطی برنامه بررسی کنید.\n۳. مطمئن شوید شبکه خصوصی (Private Network) دیتابیس و برنامه یکسان است.",
		})
	}

	// 4. Port mismatch / 502 Bad Gateway
	if strings.Contains(logText, "502 bad gateway") || strings.Contains(logText, "504 gateway time-out") || strings.Contains(logText, "failed to connect to upstream") {
		diagnoses = append(diagnoses, Diagnosis{
			ErrorType: "خطای 502 Bad Gateway (عدم تطابق پورت)",
			Cause:     "وب‌سرور داخلی برنامه شما روی پورتی متفاوت از پورت مشخص‌شده در `liara.json` گوش می‌دهد.",
			Solution:  "۱. پورت برنامه را در `liara.json` مشخص کنید (مثلاً `\"port\": 3000` یا `\"port\": 8080`).\n۲. اطمینان حاصل کنید برنامه شما روی `0.0.0.0` گوش می‌دهد، نه فقط `127.0.0.1`.",
		})
	}

	// 5. Python Gunicorn or ModuleNotFound
	if strings.Contains(logText, "modulenotfounderror") || strings.Contains(logText, "no module named") {
		diagnoses = append(diagnoses, Diagnosis{
			ErrorType: "پکیج پایتون یافت نشد (ModuleNotFoundError)",
			Cause:     "یک یا چند ماژول مورد نیاز برنامه در فایل `requirements.txt` درج نشده‌اند.",
			Solution:  "دستور زیر را در محیط محلی خود اجرا کرده و مجدداً دیپلوی کنید:\n```bash\npip freeze > requirements.txt\nliara deploy\n```",
		})
	}

	// 6. Django DisallowedHost
	if strings.Contains(logText, "disallowedhost") || strings.Contains(logText, "invalid http_host header") {
		diagnoses = append(diagnoses, Diagnosis{
			ErrorType: "خطای DisallowedHost در جنگو",
			Cause:     "دامنه یا آدرس لیارای برنامه در تنظیمات `ALLOWED_HOSTS` جنگو اضافه نشده است.",
			Solution:  "در فایل `settings.py` جنگو:\n```python\nALLOWED_HOSTS = ['*']  # یا افزودن دامنه‌های مشخص لیارا\n```",
		})
	}

	// If no specific signature matched, provide general intelligent diagnosis
	if len(diagnoses) == 0 {
		return &ToolResult{
			Success: true,
			Data: fmt.Sprintf("**تحلیل و بررسی لاگ:**\n\n```text\n%s\n```\n\n"+
				"**اقدامات پیشنهادی برای رفع خطا:**\n"+
				"۱. **بررسی لاگ‌های زنده:** دستور `liara logs --app <app-name>` را اجرا کنید تا لاگ کامل خطا را مشاهده نمایید.\n"+
				"۲. **بررسی پورت و فایل کانفیگ:** اطمینان حاصل کنید فایل `liara.json` با پورت صحیح برنامه مطابقت دارد.\n"+
				"۳. **بررسی متغیرهای محیطی:** مقادیر متغیرها (Environment Variables) در پنل لیارا را بازبینی کنید.", input),
		}, nil
	}

	var outputBuilder strings.Builder
	outputBuilder.WriteString("**نتیجه تحلیل هوشمند لاگ خطای لیارا:**\n\n")

	for i, d := range diagnoses {
		outputBuilder.WriteString(fmt.Sprintf("### %d. %s\n", i+1, d.ErrorType))
		outputBuilder.WriteString(fmt.Sprintf("**علت اصلی:** %s\n\n", d.Cause))
		outputBuilder.WriteString(fmt.Sprintf("**راه‌حل گام‌به‌گام:**\n%s\n\n", d.Solution))
		outputBuilder.WriteString("---\n")
	}

	outputBuilder.WriteString("**مرحله بعدی:** پس از اعمال تغییرات بالا، دستور زیر را برای استقرار مجدد اجرا کنید:\n```bash\nliara deploy\n```")

	return &ToolResult{
		Success: true,
		Data:    outputBuilder.String(),
		Meta: map[string]interface{}{
			"diagnoses_count": len(diagnoses),
		},
	}, nil
}
