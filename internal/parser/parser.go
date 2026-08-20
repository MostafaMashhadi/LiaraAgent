package parser

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"unicode/utf8"
)

var (
	titleTagRegex     = regexp.MustCompile(`(?i)<title>(.*?)(?:\s*-\s*لیارا)?</title>`)
	headTagRegex      = regexp.MustCompile(`(?s)<Head>[\s\S]*?</Head>`)
	sectionTagRegex   = regexp.MustCompile(`(?i)<Section(?:\s+id="[^"]*")?\s+title="([^"]+)"(?:\s+id="[^"]*")?\s*/?>`)
	highlightRegex    = regexp.MustCompile("(?s)<Highlight\\s+className=[\"']([^\"']+)[\"']>\\s*\\{`([\\s\\S]*?)`\\}\\s*</Highlight>")
	importantRegex    = regexp.MustCompile(`(?s)<Important>(.*?)</Important>`)
	alertRegex        = regexp.MustCompile(`(?s)<Alert(?:\s+variant=['"][^'"]*['"])?>([\s\S]*?)</Alert>`)
	linkRegex         = regexp.MustCompile(`(?i)<Link\s+[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Link>`)
	anchorRegex       = regexp.MustCompile(`(?i)<a\s+[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>`)
	importRegex       = regexp.MustCompile(`(?m)^\s*import\s+[^;]+;?\s*$`)
	multiImportRegex  = regexp.MustCompile(`(?s)import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?`)
	jsxCommentRegex   = regexp.MustCompile(`(?s)\{/\*[\s\S]*?\*/\}`)
	tableTagRegex     = regexp.MustCompile(`(?s)<Table[\s\S]*?/>`)
	stepTagRegex      = regexp.MustCompile(`(?i)<Step\s+steps=\s*\{\s*\[`)
	stepItemRegex     = regexp.MustCompile(`(?s)step:\s*["']([^"']+)["']\s*,\s*content:\s*\(?`)
	mapBlockRegex     = regexp.MustCompile(`(?s)\{\s*\[[\s\S]*?\.map\s*\([\s\S]*?\)\s*\)\s*\}|(?s)\{\s*\[[\s\S]*?\.map\s*\([\s\S]*?\)\s*\}|(?s)\[[\s\S]*?\.map\s*\([\s\S]*?\)\s*\)\s*\}?`)
	objItemRegex      = regexp.MustCompile(`(?s)\{\s*(?:alt|platform|title|text)\s*:\s*['"]([^'"]+)['"](?:\s*,\s*(?:platform|title|text)\s*:\s*['"]([^'"]+)['"])?\s*,\s*link\s*:\s*['"]([^'"]+)['"]\s*\}`)
	objItemAltRegex   = regexp.MustCompile(`(?s)\{\s*link\s*:\s*['"]([^'"]+)['"]\s*,\s*(?:alt|platform|title|text)\s*:\s*['"]([^'"]+)['"]\s*\}`)
	titleLinkRegex    = regexp.MustCompile(`(?s)title\s*:\s*["']([^"']+)["']\s*,\s*link\s*:\s*["']([^"']+)["']`)
	linkTitleRegex    = regexp.MustCompile(`(?s)link\s*:\s*["']([^"']+)["']\s*,\s*title\s*:\s*["']([^"']+)["']`)
	textLinkRegex     = regexp.MustCompile(`(?s)text\s*:\s*["']([^"']+)["']\s*,\s*link\s*:\s*["']([^"']+)["']`)
	linkTextRegex     = regexp.MustCompile(`(?s)link\s*:\s*["']([^"']+)["']\s*,\s*text\s*:\s*["']([^"']+)["']`)
	htmlAnchorRegex   = regexp.MustCompile(`(?i)<a\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)</a>`)
	jsxLinkRegex      = regexp.MustCompile(`(?i)<Link\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)</Link>`)
	htmlH1Regex       = regexp.MustCompile(`(?i)<h1[^>]*>([\s\S]*?)</h1>`)
	htmlH2Regex       = regexp.MustCompile(`(?i)<h2[^>]*>([\s\S]*?)</h2>`)
	htmlH3Regex       = regexp.MustCompile(`(?i)<h3[^>]*>([\s\S]*?)</h3>`)
	htmlH4Regex       = regexp.MustCompile(`(?i)<h4[^>]*>([\s\S]*?)</h4>`)
	htmlBoldRegex     = regexp.MustCompile(`(?i)<(?:b|strong)[^>]*>([^<]*?)</(?:b|strong)>`)
	htmlParaRegex     = regexp.MustCompile(`(?i)<p[^>]*>([\s\S]*?)</p>`)
	htmlListRegex     = regexp.MustCompile(`(?i)</?(?:ul|ol)[^>]*>`)
	htmlListItemOpen  = regexp.MustCompile(`(?i)<li[^>]*>`)
	htmlListItemClose = regexp.MustCompile(`(?i)</li>`)
	reactComponentTag = regexp.MustCompile(`(?s)</?[A-Z][a-zA-Z0-9_]*[^>]*>`)
	jsxTagRegex       = regexp.MustCompile(`</?(?:Layout|Head|meta|hr|br|div|p|span|Tabs|Step|Card|NextPage|Button|TickBadge|IconContainer|PlatformIcon|HighlightTabs|video|img|ul|li|ol|a|Link|b|strong|i|em)[^>]*>|<>|</>`)
	jsResidualsRegex  = regexp.MustCompile(`(?m)^\s*[\(\)\{\}\[\],\/><=;:\|\\]+\s*$`)
)

const (
	// DefaultMaxChunkSize is the target character limit for a single chunk before splitting by paragraphs
	DefaultMaxChunkSize = 2500
	// DefaultChunkOverlap is the character overlap when sub-chunking very large sections
	DefaultChunkOverlap = 200
)

// Parser handles reading, parsing, and chunking Markdown and MDX files.
type Parser struct {
	MaxChunkSize int
	ChunkOverlap int
}

// NewParser creates a new Parser with default or custom chunk sizing options.
func NewParser(maxChunkSize, chunkOverlap int) *Parser {
	if maxChunkSize <= 0 {
		maxChunkSize = DefaultMaxChunkSize
	}
	if chunkOverlap < 0 {
		chunkOverlap = DefaultChunkOverlap
	}
	return &Parser{
		MaxChunkSize: maxChunkSize,
		ChunkOverlap: chunkOverlap,
	}
}

// ParseFile parses a markdown/mdx file at filePath and extracts structured chunks and metadata.
func (p *Parser) ParseFile(filePath string, baseDir string) (*Document, error) {
	contentBytes, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat file %s: %w", filePath, err)
	}

	hash := sha256.Sum256(contentBytes)
	contentHash := hex.EncodeToString(hash[:])

	relPath, err := filepath.Rel(baseDir, filePath)
	if err != nil {
		relPath = filePath
	}

	// Extract category from directory hierarchy (e.g. "paas/nodejs/..." -> "paas")
	category := extractCategory(relPath)

	doc := &Document{
		FilePath:     filePath,
		Category:     category,
		ContentHash:  contentHash,
		LastModified: fileInfo.ModTime(),
	}

	rawContent := string(contentBytes)
	cleanedContent, extractedTitle := preprocessMDX(rawContent)

	chunks, docTitle, originalURL := p.ChunkMarkdown(cleanedContent, relPath, category)
	if docTitle == "" || docTitle == inferTitleFromPath(relPath) {
		if extractedTitle != "" {
			docTitle = extractedTitle
		}
	}
	if originalURL == "" {
		originalURL = inferCanonicalURL(relPath)
	}

	doc.DocTitle = docTitle
	doc.OriginalURL = originalURL
	doc.Chunks = chunks

	// Update chunk URLs if they were empty
	for i := range doc.Chunks {
		if doc.Chunks[i].OriginalURL == "" {
			doc.Chunks[i].OriginalURL = originalURL
			doc.Chunks[i].Metadata["original_url"] = originalURL
		}
		if doc.Chunks[i].DocTitle == "" {
			doc.Chunks[i].DocTitle = docTitle
			doc.Chunks[i].Metadata["doc_title"] = docTitle
		}
	}

	return doc, nil
}

// Section represents a parsed section under a markdown header.
type Section struct {
	HeaderLevel int
	Title       string
	Content     string
}

// ChunkMarkdown parses markdown text, identifies sections by headings (#, ##, ###),
// and breaks them down into chunks without splitting code blocks.
func (p *Parser) ChunkMarkdown(content, relPath, category string) ([]DocumentChunk, string, string) {
	scanner := bufio.NewScanner(strings.NewReader(content))
	var lines []string
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	var originalURL string
	var docTitle string
	var sections []Section

	currentSection := Section{
		HeaderLevel: 0,
		Title:       "",
		Content:     "",
	}

	var sectionLines []string
	inCodeBlock := false

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		// Strip UTF-8 BOM if present on first line
		if i == 0 {
			line = strings.TrimPrefix(line, "\ufeff")
			line = strings.TrimPrefix(line, "\xef\xbb\xbf")
		}
		trimmed := strings.TrimSpace(line)

		// Extract canonical original URL (typically "Original link: https://docs.liara.ir/...")
		if originalURL == "" && strings.HasPrefix(strings.ToLower(trimmed), "original link:") {
			colonIdx := strings.Index(trimmed, ":")
			if colonIdx != -1 {
				originalURL = strings.TrimSpace(trimmed[colonIdx+1:])
			}
			continue
		}

		// Track code fence state to avoid false-matching markdown headers inside code snippets
		if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
			inCodeBlock = !inCodeBlock
		}

		if !inCodeBlock && isHeader(trimmed) {
			level, headerText := parseHeader(trimmed)
			headerText = cleanHeading(headerText)

			// The first heading seen is considered the Document Title
			if docTitle == "" && headerText != "" {
				docTitle = headerText
			}

			// If we have accumulated lines for the previous section, save it
			if len(sectionLines) > 0 {
				currentSection.Content = strings.TrimSpace(strings.Join(sectionLines, "\n"))
				if currentSection.Content != "" {
					sections = append(sections, currentSection)
				}
				sectionLines = nil
			}

			currentSection = Section{
				HeaderLevel: level,
				Title:       headerText,
			}
			continue
		}

		sectionLines = append(sectionLines, line)
	}

	// Append the final section
	if len(sectionLines) > 0 {
		currentSection.Content = strings.TrimSpace(strings.Join(sectionLines, "\n"))
		if currentSection.Content != "" {
			sections = append(sections, currentSection)
		}
	}

	if docTitle == "" {
		docTitle = inferTitleFromPath(relPath)
	}

	// Transform sections into sized DocumentChunks
	var chunks []DocumentChunk
	chunkIndex := 0

	for _, sec := range sections {
		cleanedContent := cleanBodyText(sec.Content)

		// If section content is small enough, make it a single chunk
		if utf8.RuneCountInString(cleanedContent) <= p.MaxChunkSize {
			chunk := createChunk(relPath, category, docTitle, sec.Title, cleanedContent, originalURL, chunkIndex)
			chunks = append(chunks, chunk)
			chunkIndex++
			continue
		}

		// Otherwise, break large section into sub-chunks along paragraphs while keeping code blocks intact
		subChunks := p.splitLargeSection(cleanedContent)
		for subIdx, subText := range subChunks {
			secTitle := sec.Title
			if len(subChunks) > 1 {
				secTitle = fmt.Sprintf("%s (بخش %d)", sec.Title, subIdx+1)
			}
			chunk := createChunk(relPath, category, docTitle, secTitle, subText, originalURL, chunkIndex)
			chunks = append(chunks, chunk)
			chunkIndex++
		}
	}

	return chunks, docTitle, originalURL
}

// splitLargeSection splits large markdown content into paragraphs while ensuring code blocks are intact.
func (p *Parser) splitLargeSection(content string) []string {
	paragraphs := strings.Split(content, "\n\n")
	var result []string
	var current strings.Builder
	inCodeBlock := false

	for _, para := range paragraphs {
		trimmed := strings.TrimSpace(para)
		if trimmed == "" {
			continue
		}

		// Check code block count in paragraph
		fenceCount := strings.Count(para, "```")
		if fenceCount%2 != 0 {
			inCodeBlock = !inCodeBlock
		}

		// If adding this paragraph exceeds MaxChunkSize and we're not inside a code block, flush
		if current.Len() > 0 && (current.Len()+len(para) > p.MaxChunkSize) && !inCodeBlock {
			result = append(result, strings.TrimSpace(current.String()))
			current.Reset()
		}

		if current.Len() > 0 {
			current.WriteString("\n\n")
		}
		current.WriteString(para)
	}

	if current.Len() > 0 {
		result = append(result, strings.TrimSpace(current.String()))
	}

	return result
}

func createChunk(relPath, category, docTitle, secTitle, rawBody, originalURL string, index int) DocumentChunk {
	displayTitle := docTitle
	if secTitle != "" && secTitle != docTitle {
		displayTitle = fmt.Sprintf("%s > %s", docTitle, secTitle)
	}
	if displayTitle == "" {
		displayTitle = inferTitleFromPath(relPath)
	}

	chunk := DocumentChunk{
		ID:            fmt.Sprintf("%s#%d", relPath, index),
		FilePath:      relPath,
		Category:      category,
		Title:         displayTitle,
		DocTitle:      docTitle,
		SectionTitle:  secTitle,
		OriginalURL:   originalURL,
		RawBody:       rawBody,
		ChunkIndex:    index,
		TokenEstimate: estimateTokens(rawBody),
		Metadata: map[string]string{
			"category":     category,
			"title":        displayTitle,
			"doc_title":    docTitle,
			"section":      secTitle,
			"original_url": originalURL,
			"file_path":    relPath,
		},
	}
	chunk.Content = chunk.ContextEnrichedContent()
	return chunk
}

func cleanHeading(text string) string {
	text = strings.TrimLeft(text, "# \t")
	text = strings.ReplaceAll(text, "####", "")
	text = strings.ReplaceAll(text, "###", "")
	text = strings.ReplaceAll(text, "##", "")
	text = strings.ReplaceAll(text, "#", "")
	return strings.TrimSpace(text)
}

func cleanBodyText(text string) string {
	text = strings.ReplaceAll(text, "[#### ", "[")
	text = strings.ReplaceAll(text, "[### ", "[")
	text = strings.ReplaceAll(text, "[## ", "[")
	text = strings.ReplaceAll(text, "[# ", "[")
	text = strings.ReplaceAll(text, " ####]", "]")
	text = strings.ReplaceAll(text, " ###]", "]")
	text = strings.ReplaceAll(text, " ##]", "]")
	text = strings.ReplaceAll(text, " #]", "]")
	return text
}

func isHeader(line string) bool {
	return strings.HasPrefix(line, "# ") ||
		strings.HasPrefix(line, "## ") ||
		strings.HasPrefix(line, "### ") ||
		strings.HasPrefix(line, "#### ") ||
		strings.HasPrefix(line, "##### ") ||
		strings.HasPrefix(line, "###### ")
}

func parseHeader(line string) (int, string) {
	level := 0
	for level < len(line) && line[level] == '#' {
		level++
	}
	title := strings.TrimSpace(line[level:])
	return level, title
}

func extractCategory(relPath string) string {
	cleanPath := filepath.ToSlash(relPath)
	cleanPath = strings.TrimPrefix(cleanPath, "src/pages/")
	cleanPath = strings.TrimPrefix(cleanPath, "pages/")
	cleanPath = strings.TrimPrefix(cleanPath, "public/llms/")
	parts := strings.Split(cleanPath, "/")
	if len(parts) > 1 {
		return parts[0]
	}
	if len(parts) == 1 && parts[0] != "" {
		ext := filepath.Ext(parts[0])
		return strings.TrimSuffix(parts[0], ext)
	}
	return "general"
}

func inferTitleFromPath(relPath string) string {
	base := filepath.Base(relPath)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	return strings.ReplaceAll(name, "-", " ")
}

// estimateTokens provides a token estimate for mixed Persian / English markdown content.
func estimateTokens(text string) int {
	runeCount := utf8.RuneCountInString(text)
	// For Persian + English mixed text, ~3 runes per token is a realistic approximation
	tokens := runeCount / 3
	if tokens == 0 && runeCount > 0 {
		return 1
	}
	return tokens
}
// preprocessMDX converts React/Next.js MDX syntax into clean, standard Markdown.
func preprocessMDX(content string) (string, string) {
	var extractedTitle string
	if match := titleTagRegex.FindStringSubmatch(content); len(match) > 1 {
		extractedTitle = strings.TrimSpace(match[1])
	}

	// 1. Remove Head block completely
	content = headTagRegex.ReplaceAllString(content, "")

	// 2. Remove JSX comments
	content = jsxCommentRegex.ReplaceAllString(content, "")

	// 3. Remove JS imports
	content = multiImportRegex.ReplaceAllString(content, "")
	content = importRegex.ReplaceAllString(content, "")

	// 3.5 Strip className and style attributes early to prevent Tailwind arbitrary values (e.g. [#2196f3]) from colliding with bracket regexes
	content = regexp.MustCompile(`(?s)className=["'][^"']*["']`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?s)style=\{\{[\s\S]*?\}\}`).ReplaceAllString(content, "")

	// 4. Convert <Highlight className="lang">{`code`}</Highlight> to ```lang\ncode\n```
	content = highlightRegex.ReplaceAllStringFunc(content, func(m string) string {
		sub := highlightRegex.FindStringSubmatch(m)
		if len(sub) > 2 {
			lang := strings.TrimSpace(sub[1])
			code := strings.TrimSpace(sub[2])
			return fmt.Sprintf("\n```%s\n%s\n```\n", lang, code)
		}
		return m
	})

	// 5. Convert <Step steps={[ ... ]} />
	content = stepTagRegex.ReplaceAllString(content, "")
	content = stepItemRegex.ReplaceAllString(content, "\n### مرحله $1\n\n")

	// 6. Convert JSX Map blocks to clean bullet links
	content = mapBlockRegex.ReplaceAllStringFunc(content, func(m string) string {
		var links []string
		for _, match := range titleLinkRegex.FindAllStringSubmatch(m, -1) {
			title := strings.TrimSpace(match[1])
			link := strings.TrimSpace(match[2])
			links = append(links, fmt.Sprintf("- [%s](%s)", cleanHeading(title), link))
		}
		for _, match := range linkTitleRegex.FindAllStringSubmatch(m, -1) {
			link := strings.TrimSpace(match[1])
			title := strings.TrimSpace(match[2])
			links = append(links, fmt.Sprintf("- [%s](%s)", cleanHeading(title), link))
		}
		for _, match := range textLinkRegex.FindAllStringSubmatch(m, -1) {
			text := strings.TrimSpace(match[1])
			link := strings.TrimSpace(match[2])
			links = append(links, fmt.Sprintf("- [%s](%s)", cleanHeading(text), link))
		}
		for _, match := range linkTextRegex.FindAllStringSubmatch(m, -1) {
			link := strings.TrimSpace(match[1])
			text := strings.TrimSpace(match[2])
			links = append(links, fmt.Sprintf("- [%s](%s)", cleanHeading(text), link))
		}
		if len(links) == 0 {
			for _, match := range objItemRegex.FindAllStringSubmatch(m, -1) {
				title := match[1]
				if match[2] != "" {
					title = match[2]
				}
				link := match[3]
				links = append(links, fmt.Sprintf("- [%s](%s)", cleanHeading(title), link))
			}
			for _, match := range objItemAltRegex.FindAllStringSubmatch(m, -1) {
				link := match[1]
				title := match[2]
				links = append(links, fmt.Sprintf("- [%s](%s)", cleanHeading(title), link))
			}
		}
		if len(links) == 0 {
			for _, match := range htmlAnchorRegex.FindAllStringSubmatch(m, -1) {
				link := match[1]
				text := strings.TrimSpace(cleanHeading(match[2]))
				if text != "" && link != "" {
					links = append(links, fmt.Sprintf("- [%s](%s)", text, link))
				}
			}
			for _, match := range jsxLinkRegex.FindAllStringSubmatch(m, -1) {
				link := match[1]
				text := strings.TrimSpace(cleanHeading(match[2]))
				if text != "" && link != "" {
					links = append(links, fmt.Sprintf("- [%s](%s)", text, link))
				}
			}
		}

		if len(links) > 0 {
			return "\n" + strings.Join(links, "\n") + "\n"
		}
		return ""
	})

	// 7. Remove Table tag
	content = tableTagRegex.ReplaceAllString(content, "")

	// 8. Convert HTML headings & formatting to Markdown
	content = htmlH1Regex.ReplaceAllString(content, "\n# $1\n\n")
	content = htmlH2Regex.ReplaceAllString(content, "\n## $1\n\n")
	content = htmlH3Regex.ReplaceAllString(content, "\n### $1\n\n")
	content = htmlH4Regex.ReplaceAllString(content, "\n#### $1\n\n")
	content = htmlBoldRegex.ReplaceAllString(content, "**$1**")
	content = htmlParaRegex.ReplaceAllString(content, "\n$1\n\n")

	// 9. Convert <Section id="..." title="My Section" /> to ## My Section
	content = sectionTagRegex.ReplaceAllString(content, "\n## $1\n\n")

	// 10. Convert <Important>text</Important> to `text` for inline code LTR isolation
	content = importantRegex.ReplaceAllStringFunc(content, func(m string) string {
		sub := importantRegex.FindStringSubmatch(m)
		if len(sub) > 1 {
			val := strings.TrimSpace(sub[1])
			// If it contains ASCII letters or symbols (code/env var), wrap in backticks for LTR isolation
			isAscii := true
			for _, r := range val {
				if r > 127 {
					isAscii = false
					break
				}
			}
			if isAscii && len(val) > 0 {
				return fmt.Sprintf(" `%s` ", val)
			}
			return fmt.Sprintf("**%s**", val)
		}
		return m
	})

	// 11. Convert <Alert variant="...">text</Alert> to > **نکته:** text with multi-line blockquotes
	content = alertRegex.ReplaceAllStringFunc(content, func(m string) string {
		sub := alertRegex.FindStringSubmatch(m)
		if len(sub) > 1 {
			body := strings.TrimSpace(sub[1])
			// Convert inner Link tags
			body = linkRegex.ReplaceAllStringFunc(body, func(lm string) string {
				lsub := linkRegex.FindStringSubmatch(lm)
				if len(lsub) > 2 {
					href := strings.TrimSpace(lsub[1])
					text := strings.TrimSpace(lsub[2])
					text = strings.Join(strings.Fields(text), " ")
					return fmt.Sprintf("[%s](%s)", text, href)
				}
				return lm
			})
			lines := strings.Split(body, "\n")
			var quoteLines []string
			for _, l := range lines {
				lTrim := strings.TrimSpace(l)
				if lTrim != "" {
					quoteLines = append(quoteLines, "> "+lTrim)
				}
			}
			return fmt.Sprintf("\n> **نکته:**\n%s\n\n", strings.Join(quoteLines, "\n"))
		}
		return m
	})

	// 12. Convert <Link href="...">text</Link> and <a href="...">text</a> to [text](href) on single line
	content = linkRegex.ReplaceAllStringFunc(content, func(m string) string {
		sub := linkRegex.FindStringSubmatch(m)
		if len(sub) > 2 {
			href := strings.TrimSpace(sub[1])
			text := strings.TrimSpace(sub[2])
			text = reactComponentTag.ReplaceAllString(text, "")
			text = strings.Join(strings.Fields(text), " ")
			if text != "" && href != "" {
				return fmt.Sprintf(" [%s](%s) ", text, href)
			}
		}
		return m
	})

	content = anchorRegex.ReplaceAllStringFunc(content, func(m string) string {
		sub := anchorRegex.FindStringSubmatch(m)
		if len(sub) > 2 {
			href := strings.TrimSpace(sub[1])
			text := strings.TrimSpace(sub[2])
			text = reactComponentTag.ReplaceAllString(text, "")
			text = strings.Join(strings.Fields(text), " ")
			if text != "" && href != "" {
				return fmt.Sprintf(" [%s](%s) ", text, href)
			}
		}
		return m
	})

	// 13. Convert HTML list items
	content = htmlListItemOpen.ReplaceAllString(content, "\n- ")
	content = htmlListItemClose.ReplaceAllString(content, "\n")
	content = htmlListRegex.ReplaceAllString(content, "\n")

	// 14. Remove remaining JSX wrapper tags, React components, and JS leftovers
	content = reactComponentTag.ReplaceAllString(content, "")
	content = jsxTagRegex.ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?s)\{\s*item\.[a-zA-Z0-9_]+\s*\}`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?s)style=\{\{[\s\S]*?\}\}`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?s)className=["'][^"']*["']`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?s)key=\{[^\}]*\}`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?s)href=\{[^\}]*\}`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?m)^\s*\[?\s*\(?(?:item|platform|data)\s*,\s*index\)?\s*=>\s*\(?`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?m)^\s*\)?\s*=>\s*\(?`).ReplaceAllString(content, "")
	// 15. Remove lone JS syntax residual lines and Step closures
	content = regexp.MustCompile(`(?s)\}\s*\]\s*\}\s*\/?>`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?s)\/\s*>`).ReplaceAllString(content, "")
	content = jsResidualsRegex.ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?m)^\s*\*\*\s*$`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?m)^\s*-\s*$`).ReplaceAllString(content, "")

	// 16. Remove accidental 4-space markdown code-block indentation from regular Persian lines
	lines := strings.Split(content, "\n")
	inCode := false
	var cleanedLines []string
	for _, l := range lines {
		trimmed := strings.TrimSpace(l)
		if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
			inCode = !inCode
			cleanedLines = append(cleanedLines, trimmed)
			continue
		}
		if inCode {
			cleanedLines = append(cleanedLines, l)
		} else {
			cleanedLines = append(cleanedLines, trimmed)
		}
	}
	content = strings.Join(cleanedLines, "\n")

	// 17. Clean any multiple consecutive blank lines
	blankLineRegex := regexp.MustCompile(`\n{3,}`)
	content = blankLineRegex.ReplaceAllString(content, "\n\n")

	return strings.TrimSpace(content), extractedTitle
}

// inferCanonicalURL maps the relative file path to the official Liara documentation URL.
func inferCanonicalURL(relPath string) string {
	cleanPath := filepath.ToSlash(relPath)
	cleanPath = strings.TrimPrefix(cleanPath, "src/pages/")
	cleanPath = strings.TrimPrefix(cleanPath, "public/llms/")
	cleanPath = strings.TrimSuffix(cleanPath, ".mdx")
	cleanPath = strings.TrimSuffix(cleanPath, ".md")
	cleanPath = strings.TrimSuffix(cleanPath, "/index")

	return fmt.Sprintf("https://docs.liara.ir/%s/", cleanPath)
}
