package rag

import (
	"fmt"
	"strings"

	"github.com/block-p/liara-helper-agent/internal/store"
	"github.com/block-p/liara-helper-agent/pkg/llm"
)

// SystemPrompt defines the persona, guidelines, and helpfulness of the Liara Cloud Assistant.
const SystemPrompt = `شما یک دستیار هوشمند، فنی، مسلط و بسیار راهنما برای پلتفرم ابری «لیارا» (Liara Cloud) و مباحث مهندسی نرم‌افزار، DevOps و استقرار هستید.
وظیفه شما این است که به سوالات، چالش‌های فنی، تنظیمات کانفیگ و عیب‌یابی خطاهای کاربران با بالاترین کیفیت، تسلط و راهنمایی گام‌به‌گام پاسخ دهید.

دستورالعمل‌های کلیدی:
۱. اولویت و ارجاع به مستندات لیارا: هر زمان که در مستندات مرجع (Context) اطلاعاتی موجود باشد، راه‌حل را منطبق بر استانداردها، دستورات CLI لیارا (مانند liara deploy)، فایل‌های تنظیمات (مانند liara.json)، دیسک‌ها، شبکه‌های خصوصی و پنل لیارا ارائه دهید و در پایان منابع مرتبط را ذکر فرمایید.
۲. انعطاف و پاسخگویی جامع: اگر سوال کاربر درباره مفاهیم برنامه‌نویسی، معماری دیتابیس، داکر، وب‌سرورها، پکیج‌ها یا رفع خطاهای کدنویسی است، هرگز نگویید «موجود نیست» یا «اطلاعاتی یافت نشد»؛ بلکه با اتکا به دانش جامع مهندسی خود به بهترین شکل پاسخ داده و در صورت لزوم راهکار پیاده‌سازی آن روی سرویس‌های ابری لیارا (PaaS, DBaaS, Storage, Mail, DNS) را شرح دهید.
۳. نمونه‌کدها و کانفیگ‌ها: کدهای نمونه، دستورات ترمینال و فایل‌های پیکربندی را همواره در بلاک‌های کدی خوانا (با مشخص کردن فرمت مانند json, bash, dockerfile, yaml, javascript, python) قرار دهید.
۴. زبان و لحن پاسخ: فارسی روان، محترمانه، فنی، شفاف و گام‌به‌گام.
۵. پیوستگی گفتگو (Conversational Memory): به تاریخچه پیام‌های قبلی کاربر اشراف داشته باشید و زمینه‌ی صحبت را با دقت دنبال کنید.`

// BuildPrompt creates the full user prompt combining retrieved doc chunks and the user's question.
func BuildPrompt(question string, results []store.SearchResult) string {
	var contextBuilder strings.Builder

	if len(results) > 0 {
		contextBuilder.WriteString("مستندات مرجع لیارا (Context):\n\n")
		for i, r := range results {
			contextBuilder.WriteString(fmt.Sprintf("--- [منبع %d: %s | %s] ---\n", i+1, r.Chunk.DocTitle, r.Chunk.OriginalURL))
			if r.Chunk.SectionTitle != "" {
				contextBuilder.WriteString(fmt.Sprintf("بخش: %s\n", r.Chunk.SectionTitle))
			}
			contextBuilder.WriteString(fmt.Sprintf("%s\n\n", r.Chunk.RawBody))
		}
		contextBuilder.WriteString("===============================\n")
		contextBuilder.WriteString(fmt.Sprintf("سوال یا درخواست کاربر:\n%s\n\n", question))
		contextBuilder.WriteString("لطفاً با توجه به مستندات بالا و دانش فنی خود، پاسخی کامل، ساختاریافته و راهگشا ارائه دهید.")
	} else {
		contextBuilder.WriteString(fmt.Sprintf("سوال یا درخواست کاربر:\n%s\n\n", question))
		contextBuilder.WriteString("لطفاً به عنوان متخصص ارشد پلتفرم ابری لیارا و DevOps، پاسخی کامل، دقیق، کاربردی و گام‌به‌گام به زبان فارسی ارائه فرمایید.")
	}

	return contextBuilder.String()
}

// BuildMessagesWithContextAndHistory builds the full chat messages slice for LLM.
func BuildMessagesWithContextAndHistory(question string, results []store.SearchResult, history []llm.ChatMessage) []llm.ChatMessage {
	messages := make([]llm.ChatMessage, 0, len(history)+2)
	messages = append(messages, llm.ChatMessage{
		Role:    "system",
		Content: SystemPrompt,
	})

	for i, h := range history {
		if i == len(history)-1 && h.Role == "user" && strings.TrimSpace(h.Content) == strings.TrimSpace(question) {
			continue
		}
		messages = append(messages, h)
	}

	userContextPrompt := BuildPrompt(question, results)
	messages = append(messages, llm.ChatMessage{
		Role:    "user",
		Content: userContextPrompt,
	})

	return messages
}
