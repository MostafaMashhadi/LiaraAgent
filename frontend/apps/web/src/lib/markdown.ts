import { marked } from 'marked'

let initialized = false

function sanitizeHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  const scripts = div.querySelectorAll('script, iframe, object, embed, form, input, textarea, button')
  scripts.forEach((el) => el.remove())
  const eventAttrs = ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onsubmit']
  const allElements = div.querySelectorAll('*')
  allElements.forEach((el) => {
    eventAttrs.forEach((attr) => el.removeAttribute(attr))
  })
  return div.innerHTML
}

export function setupMarkdownRenderer() {
  if (initialized) return
  initialized = true

  const renderer = new marked.Renderer()
  renderer.code = function (codeToken: { text?: string; lang?: string; raw?: string }) {
    const code = codeToken.text || codeToken.raw || ''
    const lang = codeToken.lang || ''
    const language = lang && typeof window !== 'undefined' && window.hljs?.getLanguage(lang) ? lang : ''
    let highlighted = code
    if (typeof window !== 'undefined' && window.hljs) {
      try {
        highlighted = language
          ? window.hljs.highlight(code, { language }).value
          : window.hljs.highlightAuto(code).value
      } catch {
        highlighted = code
      }
    }
    const langLabel = (language || lang || 'code').toUpperCase()
    const codeId = 'code_' + Math.random().toString(36).substring(2, 9)
    return `
<div class="my-3 rounded-xl overflow-hidden border border-border bg-muted">
  <div class="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
    <span class="text-xs font-semibold text-primary">${langLabel}</span>
    <button onclick="window.copyCodeBlock('${codeId}')" class="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors">کپی کد</button>
  </div>
  <pre class="p-3 overflow-x-auto"><code id="${codeId}" class="hljs ${language} text-xs">${highlighted}</code></pre>
</div>
`
  }
  marked.use({ renderer, breaks: true, gfm: true })

  if (typeof window !== 'undefined') {
    window.copyCodeBlock = function (id: string) {
      const elem = document.getElementById(id)
      if (!elem) return
      const text = elem.innerText || elem.textContent
      if (text) {
        navigator.clipboard.writeText(text)
      }
    }
  }
}

export function renderMarkdown(content: string): string {
  if (!initialized) setupMarkdownRenderer()
  const raw = marked.parse(content || '') as string
  return sanitizeHtml(raw)
}

if (typeof window !== 'undefined') {
  setupMarkdownRenderer()
}
