package parser

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseHeader(t *testing.T) {
	tests := []struct {
		input     string
		wantLevel int
		wantTitle string
	}{
		{"# سرویس هوش مصنوعی لیارا", 1, "سرویس هوش مصنوعی لیارا"},
		{"## استقرار پلتفرم Node.js", 2, "استقرار پلتفرم Node.js"},
		{"### تنظیم متغیرهای محیطی", 3, "تنظیم متغیرهای محیطی"},
		{"#### زیر بخش", 4, "زیر بخش"},
	}

	for _, tt := range tests {
		level, title := parseHeader(tt.input)
		if level != tt.wantLevel {
			t.Errorf("parseHeader(%q) level = %d; want %d", tt.input, level, tt.wantLevel)
		}
		if title != tt.wantTitle {
			t.Errorf("parseHeader(%q) title = %q; want %q", tt.input, title, tt.wantTitle)
		}
	}
}

func TestChunkMarkdown_CodeBlockProtection(t *testing.T) {
	mdContent := `Original link: https://docs.liara.ir/paas/nodejs/getting-started/

# مستندات پلتفرم Node.js

در این بخش نحوه راه‌اندازی پروژه Node.js توضیح داده شده است.

## نحوه تنظیم Dockerfile

برای ایجاد Dockerfile می‌توانید از دستورات زیر استفاده کنید:

` + "```dockerfile" + `
# این یک کامنت داخل داکرفایل است و نباید به عنوان هدر در نظر گرفته شود
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
` + "```" + `

## متغیرهای محیطی

متغیرها در کنسول لیارا قابل تنظیم هستند.
`

	p := NewParser(1000, 50)
	chunks, docTitle, originalURL := p.ChunkMarkdown(mdContent, "paas/nodejs/getting-started.md", "paas")

	if originalURL != "https://docs.liara.ir/paas/nodejs/getting-started/" {
		t.Fatalf("expected originalURL to match, got %s", originalURL)
	}

	if docTitle != "مستندات پلتفرم Node.js" {
		t.Fatalf("expected docTitle to match, got %s", docTitle)
	}

	if len(chunks) < 2 {
		t.Fatalf("expected at least 2 chunks, got %d", len(chunks))
	}

	// Verify that code block content was preserved intact inside the Dockerfile chunk
	dockerfileChunkFound := false
	for _, c := range chunks {
		if strings.Contains(c.RawBody, "FROM node:18-alpine") {
			dockerfileChunkFound = true
			if !strings.Contains(c.RawBody, "# این یک کامنت داخل داکرفایل است") {
				t.Errorf("code block comment was improperly stripped or split")
			}
			if c.SectionTitle != "نحوه تنظیم Dockerfile" {
				t.Errorf("expected section title 'نحوه تنظیم Dockerfile', got %s", c.SectionTitle)
			}
		}
	}

	if !dockerfileChunkFound {
		t.Errorf("expected to find chunk containing dockerfile code block")
	}
}

func TestIngestionEngine(t *testing.T) {
	// Create a temporary directory with sample markdown files
	tmpDir, err := os.MkdirTemp("", "liara-docs-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	subDir := filepath.Join(tmpDir, "paas")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatalf("failed to create sub dir: %v", err)
	}

	sampleFile := filepath.Join(subDir, "go.md")
	content := `Original link: https://docs.liara.ir/paas/go/getting-started/

# استقرار برنامه‌های Go

لیارا از برنامه‌های Go پشتیبانی می‌کند.

## فایل liara.json

نمونه فایل تنظیمات:

` + "```json" + `
{
  "platform": "go",
  "app": "my-go-app",
  "port": 8080
}
` + "```"

	if err := os.WriteFile(sampleFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write sample file: %v", err)
	}

	engine := NewIngestionEngine(nil)
	res, err := engine.IngestDirectory(tmpDir)
	if err != nil {
		t.Fatalf("IngestDirectory failed: %v", err)
	}

	if res.TotalFiles != 1 {
		t.Errorf("expected 1 file, got %d", res.TotalFiles)
	}

	if res.TotalChunks == 0 {
		t.Errorf("expected at least 1 chunk, got %d", res.TotalChunks)
	}

	if len(res.Errors) > 0 {
		t.Errorf("expected 0 errors, got %v", res.Errors)
	}
}

func TestMDXPreprocessing(t *testing.T) {
	mdxContent := "import Layout from \"@/components/Layout\";\n" +
		"import Highlight from \"@/components/Common/highlight\";\n" +
		"import Head from \"next/head\";\n\n" +
		"<Layout>\n" +
		"<Head>\n" +
		"<title>مستندات اتصال به PostgreSQL در NodeJS - لیارا</title>\n" +
		"</Head>\n" +
		"# اتصال به دیتابیس PostgreSQL\n\n" +
		"برای اتصال از پکیج <Important>pg</Important> استفاده کنید:\n\n" +
		"<div dir='ltr'>\n" +
		"    <Highlight className=\"js\">\n" +
		"        {`const { Pool } = require('pg');\n" +
		"const pool = new Pool({ connectionString: process.env.PG_URI });`}\n" +
		"    </Highlight>\n" +
		"</div>\n\n" +
		"<Section id=\"pooling\" title=\"تنظیم Connection Pooling\" />\n\n" +
		"توضیحات استفاده از Connection Pooling در نود جی‌اس.\n\n" +
		"<Alert variant=\"success\">این یک نکته مهم است</Alert>\n\n" +
		"</Layout>"

	p := NewParser(1000, 50)
	tmpDir, _ := os.MkdirTemp("", "mdx-test-*")
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "nodejs.mdx")
	_ = os.WriteFile(filePath, []byte(mdxContent), 0644)

	doc, err := p.ParseFile(filePath, tmpDir)
	if err != nil {
		t.Fatalf("failed to parse mdx: %v", err)
	}

	if !strings.Contains(doc.DocTitle, "PostgreSQL") {
		t.Errorf("expected PostgreSQL in title, got: %s", doc.DocTitle)
	}

	foundCode := false
	foundSection := false
	for _, chunk := range doc.Chunks {
		if strings.Contains(chunk.RawBody, "const { Pool } = require('pg')") {
			foundCode = true
		}
		if strings.Contains(chunk.SectionTitle, "تنظیم Connection Pooling") {
			foundSection = true
		}
	}

	if !foundCode {
		t.Errorf("code block was not extracted properly from Highlight component")
	}
	if !foundSection {
		t.Errorf("section title was not extracted from Section component")
	}
}

func TestStepAndIndentationCleaning(t *testing.T) {
	stepMDX := `<Layout>
# پیکربندی افزونه

<Step steps={[
{
  step: "۱",
  content: (
  <>
    <h3>پیکربندی افزونه در VSCode</h3>
    <p>
        پس از نصب افزونه، گزینه Use your own API Key را انتخاب کنید.
    </p>
  </>
  )
},
{
  step: "۲",
  content: (
  <>
    <h3>اضافه‌کردن هوش مصنوعی لیارا</h3>
    <p>
        در قسمت <b>API Provider</b> گزینه <b>OpenAI Compatible</b> را انتخاب کنید.
    </p>
  </>
  )
}
]}/>
</Layout>`

	p := NewParser(1000, 50)
	tmpDir, _ := os.MkdirTemp("", "step-test-*")
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "kilo.mdx")
	_ = os.WriteFile(filePath, []byte(stepMDX), 0644)

	doc, err := p.ParseFile(filePath, tmpDir)
	if err != nil {
		t.Fatalf("failed to parse step mdx: %v", err)
	}

	allBody := ""
	for _, c := range doc.Chunks {
		allBody += "\n" + c.SectionTitle + "\n" + c.RawBody
	}

	if strings.Contains(allBody, "<h3") || strings.Contains(allBody, "</h3") {
		t.Errorf("h3 tag was not converted to markdown heading: %s", allBody)
	}
	if strings.Contains(allBody, "content: (") {
		t.Errorf("raw JSX content: ( was not cleaned: %s", allBody)
	}
	if !strings.Contains(allBody, "پیکربندی افزونه در VSCode") {
		t.Errorf("step 1 heading not found: %s", allBody)
	}
	if !strings.Contains(allBody, "**API Provider**") {
		t.Errorf("bold tag not converted: %s", allBody)
	}
}

func TestJSXMapWithHTMLNodes(t *testing.T) {
	openWebMDX := `<Layout>
# اتصال به OpenWeb

برای راه‌اندازی برنامه دو سرویس زیر را ایجاد کنید:

<ul className="pr-4">
  {[
    {text: <p><a href="/one-click-apps/openwebui/quick-start/" className="text-[#2196f3]">برنامه آماده OpenWeb</a></p>,},
    {text: <p><a href="/ai/quick-start/" className="text-[#2196f3]">سرویس هوش مصنوعی لیارا</a></p>,},
  ].map((item, index) => (
    <li key={index} style={{ textDecorationColor: "#9ca3af" }}>
     {item.text}
    </li>
  ))}
</ul>

گام بعدی:
</Layout>`

	p := NewParser(1000, 50)
	tmpDir, _ := os.MkdirTemp("", "openweb-test-*")
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "openweb.mdx")
	_ = os.WriteFile(filePath, []byte(openWebMDX), 0644)

	doc, err := p.ParseFile(filePath, tmpDir)
	if err != nil {
		t.Fatalf("failed to parse openweb mdx: %v", err)
	}

	body := doc.Chunks[0].RawBody
	if strings.Contains(body, "map(item") || strings.Contains(body, "{text:") || strings.Contains(body, "{item.text}") {
		t.Errorf("residual map code found: %s", body)
	}
	if !strings.Contains(body, "[برنامه آماده OpenWeb](/one-click-apps/openwebui/quick-start/)") {
		t.Errorf("expected link not found: %s", body)
	}
	if !strings.Contains(body, "[سرویس هوش مصنوعی لیارا](/ai/quick-start/)") {
		t.Errorf("expected link 2 not found: %s", body)
	}
}

func TestDBaaSAboutMDXCleanup(t *testing.T) {
	dbaasMDX := `<Layout>
# سرویس دیتابیس

<ul>
  {[
      {
        title: "آشنایی با بخش دسترسی سریع (لینک‌های اتصال) دیتابیس‌ها",
        link: "/dbaas/details/connection-links"
      },
      {
        title: "آشنایی با قابلیت Connection Pooling",
        link: "/dbaas/details/connection-pool"
      },
      {
        title: "اتصال به دیتابیس ElasticSearch از طریق اسکریپت‌های پایتونی",
        link: "/dbaas/elastic-search/how-tos/connect-via-platform/python"
      },
  ].map((item, index) => (
    <li
      key={index}
      style={{
        listStyle: "persian",
        textDecoration: "underline",
        textDecorationColor: "#9ca3af"
      }}
    >
      <a
        className="flex w-[max-content] items-center gap-2 text-[18px] mt-4"
        href={item.link}
      >
        {item.title}
        <GoArrowLeft className="ml-2 text-[15px] text-[gray]" />
      </a>
    </li>
  ))}
</ul>
</Layout>`

	p := NewParser(1000, 50)
	tmpDir, _ := os.MkdirTemp("", "dbaas-test-*")
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "about.mdx")
	_ = os.WriteFile(filePath, []byte(dbaasMDX), 0644)

	doc, err := p.ParseFile(filePath, tmpDir)
	if err != nil {
		t.Fatalf("failed to parse dbaas about mdx: %v", err)
	}

	body := doc.Chunks[0].RawBody
	if strings.Contains(body, "GoArrowLeft") || strings.Contains(body, "className=") || strings.Contains(body, "style={{") || strings.Contains(body, "index) =>") {
		t.Errorf("residual JSX code found in body: %s", body)
	}
	if !strings.Contains(body, "[اتصال به دیتابیس ElasticSearch از طریق اسکریپت‌های پایتونی](/dbaas/elastic-search/how-tos/connect-via-platform/python)") {
		t.Errorf("expected clean markdown link not found: %s", body)
	}
}

func TestAngularGettingStartedMDXCleanup(t *testing.T) {
	angularMDX := `<Layout>
# شروع به کار با پلتفرم Angular
<hr className="mb-2" />

<a href="https://angular.dev/" className="text-[#2196f3] ">Angular</a>  یک فریمورک متن‌باز و قدرتمند است.

<div className="grid md:grid-cols-2 gap-4">
            {[
    {
      text: 'استقرار سریع یک برنامه Angular در لیارا',
      link: './quick-start',
    },
    {
      text: 'استقرار قدم به قدم برنامه‌های Angular در لیارا',
      link: './how-tos/create-app',
    },
  ].map(item =>
              <Link href={item.link}>
                <Card className="flex cursor-pointer w-full items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h4>
                      {item.text}
                    </h4>
                  </div>
                  <GoArrowLeft className="ml-1" />
                </Card>
              </Link>
            )}
          </div>

<br />

<Alert variant="success">
همچنین بخوانید:
<Link href='./related-links' className="text-[#2196f3] ">
 لینک‌های مرتبط با پلتفرم Angular
</Link>
</Alert>
</Layout>`

	p := NewParser(1000, 50)
	tmpDir, _ := os.MkdirTemp("", "angular-test-*")
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "getting-started.mdx")
	_ = os.WriteFile(filePath, []byte(angularMDX), 0644)

	doc, err := p.ParseFile(filePath, tmpDir)
	if err != nil {
		t.Fatalf("failed to parse angular mdx: %v", err)
	}

	body := doc.Chunks[0].RawBody
	if strings.Contains(body, "(related-links/.)[") || strings.Contains(body, "GoArrowLeft") || strings.Contains(body, "item =>") {
		t.Errorf("residual JSX or reversed link found: %s", body)
	}
	if !strings.Contains(body, "[Angular](https://angular.dev/)") {
		t.Errorf("expected [Angular](https://angular.dev/), got: %s", body)
	}
	if !strings.Contains(body, "[لینک‌های مرتبط با پلتفرم Angular](./related-links)") {
		t.Errorf("expected clean related-links link, got: %s", body)
	}
}

func TestKiloCodeMDXCleanup(t *testing.T) {
	filePath := "../../data/docs/src/pages/ai/connect-to-service/kilo-code.mdx"
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		t.Skip("kilo-code.mdx not present in local checkout, skipping")
	}
	p := NewParser(1000, 50)
	doc, err := p.ParseFile(filePath, "../../data/docs/src/pages")
	if err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	t.Logf("Total chunks: %d", len(doc.Chunks))
	for i, c := range doc.Chunks {
		t.Logf("--- Chunk %d (Title: %s) ---\n%s\n", i, c.SectionTitle, c.RawBody)
	}
}
