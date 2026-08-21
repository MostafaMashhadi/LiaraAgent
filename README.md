# 🚀 Liara Helper Agent | دستیار هوشمند و عامل ابری لیارا

[![Go Version](https://img.shields.io/badge/Go-1.23%2B-00ADD8?style=flat&logo=go)](https://golang.org)
[![React & Vite](https://img.shields.io/badge/Frontend-React%20%7C%20Vite%20%7C%20Tailwind-61DAFB?style=flat&logo=react)](https://vitejs.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![AvalAI Compatible](https://img.shields.io/badge/Gateway-AvalAI%20%7C%20OpenAI%20%7C%20Gemini-emerald?style=flat)](https://avalai.ir)
[![Liara Cloud](https://img.shields.io/badge/Deploy-Liara%20Cloud-blue?style=flat)](https://liara.ir)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

دستیار هوشمند و عامل فنی پیشرفته (Agentic RAG) طراحی شده برای پلتفرم ابری **لیارا (Liara Cloud)**؛ با قابلیت پاسخ‌گویی به سوالات، عیب‌یابی خطاهای استقرار، ساخت و ویرایش فایل‌های کانفیگ با **حالت Vim**، پایگاه‌داده PostgreSQL برای ذخیره چت‌ها و لاگ‌ها، سیستم ریت‌لیمیت ضد اسپم، و پنل مدیریت جامع با تنظیم زنده خلاقیت هوش مصنوعی (Temperature) و ضرایب هزینه توکن‌ها.

---

## 🌟 قابلیت‌های برجسته سیستم (Key Features)

### ۱. 🧠 موتور جستجوی هیبریدی و پردازش مستندات (Hybrid RAG)
- **پارس هوشمند MDX و مستندات رسمی لیارا:** فیلتر تگ‌های React و تبدیل خودکار به Markdown معتبر با حفظ جداول، کدها و مراحل (`<Step>`, `<Important>`, `<Alert>`).
- **جستجوی ترکیبی (Hybrid Search):** ادغام جستجوی معنایی وکتوری (Dense Vector) و تطابق متنی واژگان فارسی (BM25 Keyword Matching).
- **پاسخ‌گویی سریع با ۰ توکن (Zero-Token Heuristics):** پاسخ بلادرنگ به تعارفات و احوالپرسی‌ها بدون مصرف توکن LLM.

### ۲. 🌐 سازگاری کامل با پلتفرم AvalAI و تمامی مدل‌های زبانی (Universal LLM Gateway)
- پشتیبانی بومی از **AvalAI** (`https://api.avalai.ir/v1`) به عنوان گیت‌وی پرسرعت و بدون تحریم در ایران.
- سازگار با تمام مدل‌های مطرح هوش مصنوعی:
  - `GPT-4o`, `GPT-4o-mini`, `GPT-4-turbo`
  - `Claude 3.5 Sonnet`, `Claude 3.5 Haiku`
  - `Gemini 1.5 Pro`, `Gemini 1.5 Flash`, `Gemini 2.0 Flash`
  - `DeepSeek R1`, `DeepSeek V3`, `Qwen 2.5 72B`, `Llama 3.3 70B`
- پشتیبانی از استریمینگ لحظه‌ای توکن‌ها (WebSocket & Server-Sent Events).

### ۳. 🎛️ پنل مدیریت پیشرفته و مانیتورینگ هزینه‌ها (Admin Dashboard & RBAC)
- **لاگ لحظه‌ای تراکنش‌ها در PostgreSQL:** ثبت دقیق توکن‌های ورودی (`Prompt`)، خروجی (`Gen`)، زمان پاسخگویی و شناسه کاربر.
- **اسلایدر تنظیم زنده خلاقیت هوش مصنوعی (Temperature):** تغییر رفتار مدل بین کاملاً دقیق (0.0) تا خلاقانه (1.0) بدون نیاز به ری‌استارت سرور.
- **تعیین ضرایب سفارشی هزینه (USD per 1M Tokens):** ورودی هزینه به ازای هر ۱ میلیون توکن و محاسبه لحظه‌ای هزینه کل به **دلار ($)** و **تومان ایران**.
- **دکمه‌های پریست سریع:** سوئیچ با یک کلیک بین نرخ‌های استاندارد AvalAI/OpenAI/Gemini.

### ۴. ⌨️ استودیوی ساخت کانفیگ با ادیتور تعاملی و Vim Mode
- ساخت فایل‌های تنظیمات `liara.json` و `Dockerfile` برای تمامی پلتفرم‌ها (Node.js, Python, Laravel, Django, Next.js, Go, Docker, ...).
- **ادیتور کد با دو حالت:**
  - **حالت عادی (Normal Mode):** ویرایش متنی ساده و روان همراه با شماره خطوط.
  - **حالت Vim Mode:** شامل کلیدهای `i`, `a`, `o`, `O`, `h`, `j`, `k`, `l`, `0`, `$`, `gg`, `G`, `x`, `dd`, `yy`, `p`, `u` و دستورات خط فرمان `:w`, `:q`, `:wq`, `:format`, `:help`.

### ۵. 🛡️ ریت‌لیمیت و جلوگیری از اسپم (Multi-Tier Rate Limiter)
- **تفکیک ریت لیمیت عمومی و AI:** سقف ۶۰ درخواست/دقیقه برای کارهای سبک و ۲۰ درخواست/دقیقه برای فراخوانی‌های سنگین LLM و وب‌سوکت.
- **ردیابی هوشمند کاربران و آی‌پی‌ها:** محافظت از حساب‌ها در برابر ارسال رگباری و حملات DoS با بازگرداندن خطای استاندارد `HTTP 429 Too Many Requests`.
- **معافیت مدیران (Admin Bypass):** دسترسی بدون محدودیت برای حساب‌های مدیر.

### ۶. 🗄️ ذخیره‌سازی داده‌ها و تاریخچه گفتگوها (PostgreSQL Database)
- ثبت کاربران، احراز هویت با توکن JWT و هش رمزعبور `bcrypt`.
- ذخیره نشست‌های گفتگو (`chat_sessions`) و پیام‌ها (`chat_messages`) همراه با عنوان هوشمند و خلاصه موضوعی (`summary`).

---

## 🏗️ معماری سیستم (System Architecture)

```mermaid
flowchart TD
    User["👤 کاربر / وب‌اپلیکیشن یا CLI"]

    subgraph Security ["🛡️ لایه امنیت و ریت‌لیمیت"]
        direction TB
        Recovery["Recovery Middleware"] --> Logger["Structured Logger (slog)"]
        Logger --> JWTAuth["JWT Authentication & RBAC"]
        JWTAuth --> RateLimiter["Multi-Tier Rate Limiter (20 RPM AI / 60 RPM General)"]
    end

    User --> Security

    subgraph Backend ["🚀 Go Backend Server (:8080)"]
        Router{"Routing Engine"}
        Cache["⚡ LRU Cache (Zero-Token Responses)"]
        AgentCore["🤖 Agentic AI Coordinator"]
        ConfigEngine["🛠️ Config Studio Engine"]
        LogAnalyzer["🔍 Log Diagnostic Tool"]
    end

    RateLimiter --> Router
    Router --> Cache
    Cache -->|"Cache Miss"| AgentCore
    Router --> ConfigEngine
    Router --> LogAnalyzer

    subgraph Gateway ["☁️ پلتفرم‌های هوش مصنوعی (OpenAI Compatible)"]
        AvalAI["🇮🇷 AvalAI Gateway (api.avalai.ir)"]
        OpenAI["🇺🇸 OpenAI API"]
        Gemini["🔷 Google Gemini Native"]
    end

    AgentCore --> Gateway

    subgraph Storage ["💾 پایگاه داده و ذخیره‌سازی"]
        Postgres[("🐘 PostgreSQL (Users, Sessions, Messages, Logs, Settings)")]
        VectorStore["⚡ Hybrid Vector / Memory Store"]
    end

    Backend <--> Postgres
    AgentCore <--> VectorStore
```

---

## 📁 ساختار فایل‌های پروژه (Project Directory Structure)

```text
liara-helper-agent/
├── cmd/
│   ├── api/                 # HTTP server, WebSocket, and REST API entrypoint
│   └── cli/                 # CLI tool for testing RAG locally
├── vite-monorepo/
│   ├── apps/
│   │   ├── test-ui/           # Primary React 19 + Vite 8 + Tailwind 4 UI (monorepo app)
│   │   │   ├── src/
│   │   │   ├── package.json
│   │   │   └── vite.config.ts # builds into ../../web/dist
│   │   └── web/               # Obsolete UI app (removed)
│   ├── packages/
│   │   └── ui/                # Shared shadcn/ui component library
│   └── pnpm-workspace.yaml
├── internal/
│   ├── agent/               # Agent coordinator, session memory, tools
│   │   └── tools/           # Config generation and log diagnosis tools
│   ├── auth/                # JWT auth, sessions, RBAC middleware
│   ├── cache/               # LRU in-memory cache
│   ├── config/              # Environment and .env loader
│   ├── database/            # PostgreSQL, migrations, token usage logs
│   ├── middleware/          # Rate limit, structured logger, security
│   ├── parser/              # MDX parser and smart chunking
│   ├── rag/                 # RAG Q&A engine and anti-hallucination prompts
│   ├── store/               # In-memory vector store and hybrid search
│   ├── sync/                # GitHub webhook doc sync
│   └── ws/                  # WebSocket chat streaming
├── pkg/
│   └── llm/                 # AvalAI / OpenAI / Gemini client
├── web/                     # Static assets served by Go
│   ├── dist/                # Vite build output (generated, gitignored)
│   ├── fallback/            # Embedded fallback UI when dist is missing
│   └── web.go               # go:embed for fallback HTML
├── data/
│   └── docs/                # Official Liara docs (cloned submodule/repo)
├── docker-compose.yml       # PostgreSQL + app stack
├── Dockerfile               # Multi-stage build (test-ui + Go)
├── liara.json               # Liara Cloud deployment config
└── .env.example             # Sample environment variables
```

---

## 🚀 راهنمای راه‌اندازی و اجرا (Quick Start Guide)

### ۱. پیش‌نیازها
- زبان برنامه‌نویسی [Go نسخه ۱.۲۳ یا بالاتر](https://go.dev/dl/)
- محیط اجرایی [Node.js نسخه ۱۸ یا بالاتر](https://nodejs.org/) و `npm`
- پایگاه‌داده [PostgreSQL](https://www.postgresql.org/) یا [Docker](https://www.docker.com/)

---

### ۲. پیکربندی متغیرهای محیطی (`.env`)

فایل `.env.example` را به `.env` کپی کنید:
```bash
cp .env.example .env
```

نمونه تنظیم با **AvalAI (پیشنهادی برای ایران)**:
```env
PORT=8080

# پایگاه داده PostgreSQL
DATABASE_URL=postgres://liara:liarapass@localhost:5432/liaradb?sslmode=disable

# اطلاعات ورود پیش‌فرض مدیر (Admin)
ADMIN_EMAIL=admin@liara.ir
ADMIN_PASSWORD=Admin@Liara2026!
JWT_SECRET=liara-agent-jwt-super-secret-key-2026

# تنظیمات هوش مصنوعی AvalAI
LLM_BASE_URL=https://api.avalai.ir/v1
LLM_API_KEY=aa-your_avalai_api_key_here
LLM_CHAT_MODEL=gpt-4o-mini
LLM_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536

# مسیر مستندات
DOCS_DIR=data/docs/src/pages
RATE_LIMIT_RPM=60
```

---

### ۳. راه‌اندازی با Docker Compose (ساده‌ترین روش)

اجرای همزمان پایگاه‌داده PostgreSQL و سرور اپلیکیشن:
```bash
docker compose up --build -d
```

---

### ۴. اجرای دستی در محیط توسعه (Manual Dev Setup)

#### گام اول: بیلد فرانت‌اند
```bash
cd vite-monorepo
pnpm install
pnpm run build
cd ..
```

#### گام دوم: اجرای بک‌اند Go
```bash
go run cmd/api/main.go
```

سپس در مرورگر خود آدرس زیر را باز کنید:
👉 **[http://localhost:8080](http://localhost:8080)**

---

## 🧪 اجرای تست‌های خودکار (Unit Tests)

برای اجرای تمامی تست‌های Go (شامل تست‌های رجکس MDX، پایگاه‌داده، ریت‌لیمیت و کلاینت LLM):
```bash
go test -v ./...
```

---

## 📡 مستندات APIها (REST & WebSocket Endpoints)

| متد | مسیر | دسترسی | توضیحات |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | عمومی | ثبت‌نام کاربر جدید |
| `POST` | `/api/auth/login` | عمومی | ورود به سیستم و دریافت توکن JWT |
| `GET` | `/api/auth/me` | کاربر | دریافت مشخصات کاربر احراز هویت شده |
| `POST` | `/api/chat` | ریت‌لیمیت AI | چت متنی با دستیار هوشمند (پشتیبانی از SSE Stream) |
| `WS` | `/ws/chat` | ریت‌لیمیت AI | سوکت دوطرفه چت بلادرنگ با هوش مصنوعی |
| `GET` | `/api/chat/sessions` | کاربر | لیست تاریخچه نشست‌های کاربر |
| `GET` | `/api/chat/messages` | کاربر | پیام‌های یک نشست خاص (`?session_id=...`) |
| `POST` | `/api/tools/config` | عمومی | تولید فایل کانفیگ `liara.json` |
| `POST` | `/api/tools/diagnose` | ریت‌لیمیت AI | عیب‌یابی و تحلیل هوشمند لاگ خطای دیپلوی |
| `GET` | `/api/docs/search` | عمومی | جستجو در مستندات (`?q=...&category=...`) |
| `GET` | `/api/admin/stats` | ادمین | آمار مصرف توکن‌ها و هزینه‌های تخمینی |
| `GET` | `/api/admin/logs` | ادمین | جدول تاریخچه لاگ تراکنش‌های LLM |
| `GET/POST` | `/api/admin/settings` | ادمین | مشاهده و تنظیم زنده خلاقیت هوش مصنوعی و نرخ توکن‌ها |
| `GET` | `/healthz` | عمومی | بررسی وضعیت سلامت سرور و اتصال دیتابیس |

---

## ☁️ استقرار روی زیرساخت ابری لیارا (Deploy to Liara)

این پروژه به همراه فایل‌های آماده `Dockerfile` و `liara.json` ارائه شده و به راحتی با دستورات زیر روی پلتفرم ابری لیارا مستقر می‌شود:

```bash
# ۱. نصب لیارا CLI
npm install -g @liara/cli

# ۲. ورود به حساب کاربری لیارا
liara login

# ۳. استقرار پروژه
liara deploy
```

---

## 📄 لایسنس (License)

این پروژه تحت مجوز **[MIT License](LICENSE)** به صورت متن‌باز منتشر شده است.
