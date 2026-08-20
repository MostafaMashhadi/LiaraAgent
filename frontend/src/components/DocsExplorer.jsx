import React, { useState, useEffect } from 'react';
import { Search, BookOpen, ExternalLink } from 'lucide-react';
import { marked } from 'marked';

export default function DocsExplorer() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Configure custom code syntax highlighter & copy buttons for marked
  useEffect(() => {
    const renderer = new marked.Renderer();
    renderer.code = function(tokenOrCode, maybeLang) {
      let code = '';
      let lang = '';
      if (typeof tokenOrCode === 'object' && tokenOrCode !== null) {
        code = tokenOrCode.text || tokenOrCode.raw || '';
        lang = tokenOrCode.lang || '';
      } else {
        code = tokenOrCode || '';
        lang = maybeLang || '';
      }

      if (typeof code !== 'string') {
        code = String(code);
      }

      const language = lang && window.hljs && window.hljs.getLanguage(lang) ? lang : '';
      let highlighted = code;
      if (window.hljs) {
        try {
          highlighted = language 
            ? window.hljs.highlight(code, { language }).value 
            : window.hljs.highlightAuto(code).value;
        } catch (e) {
          highlighted = code;
        }
      }
      const langLabel = (language || lang || 'code').toUpperCase();
      const codeId = 'code_' + Math.random().toString(36).substring(2, 9);
      
      return `
        <div class="code-block-wrapper my-3 rounded-xl overflow-hidden border border-[#333333] bg-[#121212] text-left" dir="ltr">
          <div class="flex items-center justify-between px-3.5 py-1.5 bg-[#1c1c1f] border-b border-[#333333] text-[11px] text-[#a0acb7] font-mono select-none">
            <span class="font-semibold text-[#38bdf8]">${langLabel}</span>
            <button onclick="window.copyCodeBlock('${codeId}')" class="flex items-center gap-1 hover:text-white transition px-2.5 py-0.5 rounded bg-[#2a2a2a] hover:bg-[#333333] text-[#eeeeee]">
              <span id="btn_${codeId}">کپی کد</span>
            </button>
          </div>
          <pre class="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono"><code id="${codeId}" class="hljs ${language}">${highlighted}</code></pre>
        </div>
      `;
    };
    marked.use({ renderer, breaks: true, gfm: true });

    window.copyCodeBlock = function(id) {
      const elem = document.getElementById(id);
      if (!elem) return;
      const text = elem.innerText || elem.textContent;
      navigator.clipboard.writeText(text);
      const btn = document.getElementById('btn_' + id);
      if (btn) {
        btn.innerText = 'کپی شد';
        setTimeout(() => {
          btn.innerText = 'کپی کد';
        }, 2000);
      }
    };
  }, []);

  const getDocTitle = (item) => {
    if (!item) return 'مستند لیارا';
    const chunk = item.chunk || item;
    let t = chunk.title || chunk.doc_title || chunk.section_title || '';
    t = t.replace(/<title>|<\/title>|مستندات|لیارا|[-–|]/gi, ' ').trim();
    if (!t || t.trim() === '') {
      if (chunk.file_path) {
        t = chunk.file_path.split('/').pop().replace(/\.mdx?$/, '').replace(/[-_]/g, ' ');
      } else {
        t = 'مستند لیارا';
      }
    }
    return t.replace(/^[#\s]+/, '').replace(/####/g, '').trim();
  };

  const getCleanDocContent = (item) => {
    if (!item) return '';
    const chunk = item.chunk || item;
    let body = chunk.raw_body || chunk.content || '';
    body = body.replace(/^Title:\s*.*?\n/i, '');
    body = body.replace(/^Source:\s*.*?\n/i, '');
    body = body.replace(/import\s+.*?;\s*\n?/g, '');
    body = body.replace(/<title>.*?<\/title>/gi, '');
    body = body.replace(/\[####\s+/g, '[');
    body = body.replace(/\[###\s+/g, '[');
    body = body.replace(/\[##\s+/g, '[');
    body = body.replace(/\[#\s+/g, '[');

    // 1. Strip classNames and styles early to prevent Tailwind [#color] bracket collision
    body = body.replace(/className=["'][^"']*["']/g, '');
    body = body.replace(/style=\{\{[\s\S]*?\}\}/g, '');

    // 2. Convert <Step ...> and <Important>
    body = body.replace(/<Step\s+steps=\s*\{\s*\[/gi, '');
    body = body.replace(/step:\s*["']([^"']+)["']\s*,\s*content:\s*\(?/gi, '\n### مرحله $1\n\n');
    body = body.replace(/<Important>(.*?)<\/Important>/gi, ' `$1` ');

    // 3. Convert JS Map arrays if any residual
    body = body.replace(/\{?\s*\[[\s\S]*?\]\s*\.map\s*\([\s\S]*?\)\s*\}?/g, (match) => {
      const links = [];
      const linkRegex = /(?:text|title)\s*:\s*['"]([^'"]+)['"]\s*,\s*link\s*:\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = linkRegex.exec(match)) !== null) {
        links.push(`- [${m[1].trim()}](${m[2].trim()})`);
      }
      return links.length > 0 ? '\n' + links.join('\n') + '\n' : '';
    });

    // 4. Convert <Alert> to multi-line Markdown blockquote
    body = body.replace(/<Alert(?:\s+variant=['"][^'"]*['"])?>([\s\S]*?)<\/Alert>/gi, (_, alertContent) => {
      const cleanAlert = alertContent
        .replace(/<(?:Link|a)\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/(?:Link|a)>/gi, (_, h, t) => `[${t.replace(/\s+/g, ' ').trim()}](${h.trim()})`)
        .trim();
      const lines = cleanAlert.split('\n').map(l => l.trim()).filter(Boolean);
      return '\n> **نکته:**\n' + lines.map(l => '> ' + l).join('\n') + '\n\n';
    });

    // 5. Convert <Link> and <a> tags to [Text](Href) on a single line
    body = body.replace(/<(?:Link|a)\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/(?:Link|a)>/gi, (_, href, text) => {
      const cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const cleanHref = href.trim();
      return cleanText && cleanHref ? ` [${cleanText}](${cleanHref}) ` : '';
    });

    // 6. Remove leftover React components and JSX attributes
    body = body.replace(/<\/?[A-Z][a-zA-Z0-9_]*[^>]*>/g, '');
    body = body.replace(/key=\{[^\}]*\}/g, '');
    body = body.replace(/href=\{[^\}]*\}/g, '');
    body = body.replace(/\[?\s*\(?(?:item|platform|data)\s*,\s*index\)?\s*=>\s*\(?/g, '');
    body = body.replace(/\)?\s*=>\s*\(?/g, '');
    body = body.replace(/\{text:\s*/g, '');
    body = body.replace(/\}\s*\]\s*\}\s*\/?>/g, '');
    body = body.replace(/\/\s*>/g, '');
    body = body.replace(/^\s*[\(\)\[\]\{\}=><,;:/\\]+\s*$/gm, '');
    body = body.replace(/^\s*\*\*\s*$/gm, '');

    // 7. Clean consecutive empty lines
    body = body.replace(/\n{3,}/g, '\n\n');
    return body.trim();
  };

  const categoriesList = [
    { id: '', label: 'همه مستندات' },
    { id: 'paas', label: 'پلتفرم (PaaS)' },
    { id: 'dbaas', label: 'دیتابیس‌ها (DBaaS)' },
    { id: 'ai', label: 'هوش مصنوعی (AI)' },
    { id: 'one-click-apps', label: 'برنامه‌های آماده' },
    { id: 'object-storage', label: 'ذخیره‌سازی ابری (S3)' },
    { id: 'email-server', label: 'سرور ایمیل' },
    { id: 'dns-management-system', label: 'دامنه و DNS' },
    { id: 'iaas', label: 'سرور ابری (IaaS)' },
    { id: 'references', label: 'منابع و CLI' },
    { id: 'overview', label: 'شروع و معرفی' },
  ];

  const searchDocs = async (searchQuery, cat) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (cat) params.append('category', cat);

      const res = await fetch(`/api/docs/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        if (data.results && data.results.length > 0) {
          setSelectedDoc(data.results[0]);
        } else {
          setSelectedDoc(null);
        }
      }
    } catch (err) {
      console.error('Failed to search docs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchDocs(query, category);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, category]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-hidden p-4 md:p-6">
      <div className="max-w-6xl w-full mx-auto flex flex-col h-full space-y-4">
        {/* Header & Search Bar */}
        <div className="space-y-3.5 pb-3.5 border-b border-[#ffffff15]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0076ff]/20 border border-[#0076ff]/30 flex items-center justify-center text-[#38bdf8]">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-white">بانک مستندات و راهنماهای رسمی لیارا</h2>
            </div>
            <span className="text-xs text-[#a0acb7]">
              <b className="font-mono text-white ml-1 font-bold">{results.length}</b> مستند یافت شد
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#7a8a94] absolute right-3.5 top-3.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در تمام مستندات، راهنماها و تنظیمات لیارا..."
              className="w-full bg-[#1c1c1f] border border-[#333333] focus:border-[#0076ff] text-[#eeeeee] text-xs md:text-sm rounded-xl py-2.5 pr-10 pl-4 outline-none transition placeholder:text-[#7a8a94]"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none">
            {categoriesList.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition text-[11px] font-medium ${
                  category === cat.id
                    ? 'bg-gradient-to-r from-[#87fcc4] to-[#28c1f5] text-[#111827] font-bold shadow-md shadow-cyan-500/20 border border-transparent'
                    : 'bg-[#222222] hover:bg-[#282828] text-[#a0acb7] hover:text-white border border-[#ffffff15]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Explorer Content */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-0">
          {/* Results List */}
          <div className="md:col-span-5 flex flex-col h-full overflow-y-auto space-y-2 pr-1">
            {isLoading && (
              <div className="text-center py-8 text-xs text-[#a0acb7]">
                در حال جستجو در پایگاه دانش...
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <div className="text-center py-12 text-xs text-[#7a8a94]">
                مستندی در این دسته‌بندی یافت نشد.
              </div>
            )}

            {!isLoading && results.map((item, idx) => {
              const chunk = item.chunk || item;
              const isSelected = selectedDoc && ((selectedDoc.id && selectedDoc.id === chunk.id) || selectedDoc === item);
              const scorePercent = item.score ? Math.round(item.score * 100) : 0;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDoc(item)}
                  className={`p-3.5 rounded-xl border text-right cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#0076ff]/20 border-[#0076ff] text-white shadow-sm'
                      : 'bg-[#222222] border-[#ffffff15] hover:border-[#333333] hover:bg-[#282828] text-[#eeeeee]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-[#38bdf8] font-mono uppercase">
                      {chunk.category || 'مستند'}
                    </span>
                    {scorePercent > 0 && query && (
                      <span className="text-[10px] text-[#7a8a94]">
                        تطابق: {scorePercent}%
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-white line-clamp-1 mb-1">
                    {getDocTitle(item)}
                  </h4>

                  <p className="text-[11px] text-[#a0acb7] line-clamp-2 leading-relaxed">
                    {getCleanDocContent(item).replace(/[#*`]/g, '')}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Full Markdown Doc Viewer */}
          <div className="md:col-span-7 flex flex-col h-full liara-panel p-5 overflow-y-auto bg-[#222222] border border-[#ffffff15]">
            {selectedDoc ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#ffffff15]">
                  <div>
                    <div className="text-[10px] text-[#38bdf8] font-mono mb-0.5 uppercase">
                      {selectedDoc.chunk?.category || selectedDoc.category || 'مستند لیارا'}
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      {getDocTitle(selectedDoc)}
                    </h3>
                  </div>

                  {(selectedDoc.chunk?.original_url || selectedDoc.original_url) && (
                    <a
                      href={selectedDoc.chunk?.original_url || selectedDoc.original_url}
                      target="_blank"
                      rel="noreferrer"
                      className="liara-btn-primary px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                    >
                      <span>مشاهده در سایت</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div
                  className="markdown-body text-xs md:text-sm text-[#eeeeee]"
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(getCleanDocContent(selectedDoc)),
                  }}
                />
              </div>
            ) : (
              <div className="text-center py-20 text-xs text-[#7a8a94]">
                یک مستند را از لیست انتخاب کنید تا متن کامل آن نمایش داده شود.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
