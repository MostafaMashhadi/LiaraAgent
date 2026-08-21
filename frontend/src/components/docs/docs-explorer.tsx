import React, { useState, useEffect } from 'react';
import { LuSearch, LuBookOpen, LuExternalLink } from 'react-icons/lu';
import { marked } from 'marked';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DocsExplorerProps {}

export default function DocsExplorer({}: DocsExplorerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    const renderer = new marked.Renderer();
    renderer.code = function (tokenOrCode, maybeLang) {
      let code = '';
      let lang = '';
      if (typeof tokenOrCode === 'object' && tokenOrCode !== null) {
        code = tokenOrCode.text || tokenOrCode.raw || '';
        lang = tokenOrCode.lang || '';
      } else {
        code = tokenOrCode || '';
        lang = maybeLang || '';
      }

      if (typeof code !== 'string') code = String(code);

      const language = lang && typeof window !== 'undefined' && window.hljs?.getLanguage(lang) ? lang : '';
      let highlighted = code;
      if (typeof window !== 'undefined' && window.hljs) {
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
        <div class="code-block-wrapper my-3 rounded-xl overflow-hidden border border-border bg-muted">
          <div class="code-block-header">
            <span class="font-semibold text-primary">${langLabel}</span>
            <button onclick="window.copyCodeBlock('${codeId}')" class="flex items-center gap-1 hover:text-white transition px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-xs">
              <span id="btn_${codeId}">کپی کد</span>
            </button>
          </div>
          <pre class="code-block-body"><code id="${codeId}" class="hljs ${language}">${highlighted}</code></pre>
        </div>
      `;
    };
    marked.use({ renderer, breaks: true, gfm: true });

    if (typeof window !== 'undefined') {
      window.copyCodeBlock = function (id) {
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
    }
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
    body = body.replace(/className=["'][^"']*["']/g, '');
    body = body.replace(/style=\{\{[\s\S]*?\}\}/g, '');
    body = body.replace(/<Step\s+steps=\s*\{\s*\[/gi, '');
    body = body.replace(/step:\s*["']([^"']+)["']\s*,\s*content:\s*\(?/gi, '\n### مرحله $1\n\n');
    body = body.replace(/<Important>(.*?)<\/Important>/gi, ' `$1` ');
    body = body.replace(/\{?\s*\[[\s\S]*?\]\s*\.map\s*\([\s\S]*?\)\s*\}?/g, (match) => {
      const links = [];
      const linkRegex = /(?:text|title)\s*:\s*['"]([^'"]+)['"]\s*,\s*link\s*:\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = linkRegex.exec(match)) !== null) {
        links.push(`- [${m[1].trim()}](${m[2].trim()})`);
      }
      return links.length > 0 ? '\n' + links.join('\n') + '\n' : '';
    });
    body = body.replace(/<Alert(?:\s+variant=['"][^'"]*['"])?>([\s\S]*?)<\/Alert>/gi, (_, alertContent) => {
      const cleanAlert = alertContent
        .replace(/<(?:Link|a)\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/(?:Link|a)>/gi, (_, h, t) => `[${t.replace(/\s+/g, ' ').trim()}](${h.trim()})`)
        .trim();
      const lines = cleanAlert.split('\n').map((l) => l.trim()).filter(Boolean);
      return '\n> **نکته:**\n' + lines.map((l) => '> ' + l).join('\n') + '\n\n';
    });
    body = body.replace(/<(?:Link|a)\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/(?:Link|a)>/gi, (_, href, text) => {
      const cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const cleanHref = href.trim();
      return cleanText && cleanHref ? ` [${cleanText}](${cleanHref}) ` : '';
    });
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
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 md:p-6">
      <div className="max-w-6xl w-full mx-auto flex flex-col h-full space-y-4">
        {/* Header & Search Bar */}
        <div className="space-y-3.5 pb-3.5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <LuBookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">بانک مستندات و راهنماهای رسمی لیارا</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              <b className="font-mono text-foreground ml-1 font-bold">{results.length}</b> مستند یافت شد
            </span>
          </div>

          <div className="relative">
            <LuSearch className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3.5" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در تمام مستندات، راهنماها و تنظیمات لیارا..."
              className="pr-10"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs select-none">
            {categoriesList.map((cat) => (
              <Button
                key={cat.id}
                variant={category === cat.id ? 'teal' : 'ghost'}
                size="sm"
                onClick={() => setCategory(cat.id)}
                className="rounded-xl whitespace-nowrap text-xs"
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Explorer Content */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-0">
          {/* Results List */}
          <div className="md:col-span-5 flex flex-col h-full overflow-y-auto space-y-2 pr-1">
            {isLoading && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                در حال جستجو در پایگاه دانش...
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <div className="text-center py-12 text-xs text-muted-foreground">
                مستندی در این دسته‌بندی یافت نشد.
              </div>
            )}

            {!isLoading && results.map((item, idx) => {
              const chunk = item.chunk || item;
              const isSelected = selectedDoc && ((selectedDoc.id && selectedDoc.id === chunk.id) || selectedDoc === item);
              const scorePercent = item.score ? Math.round(item.score * 100) : 0;
              return (
                <Card
                  key={idx}
                  onClick={() => setSelectedDoc(item)}
                  className={cn(
                    'p-3.5 rounded-xl border text-right cursor-pointer transition-all duration-200 elevation-1 hover:elevation-2',
                    isSelected
                      ? 'bg-primary/10 border-primary text-foreground'
                      : 'bg-card border-border hover:border-primary/30 text-foreground'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={isSelected ? 'teal' : 'secondary'} className="text-[10px]">
                      {chunk.category || 'مستند'}
                    </Badge>
                    {scorePercent > 0 && query && (
                      <span className="text-[10px] text-muted-foreground">
                        تطابق: {scorePercent}%
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-foreground line-clamp-1 mb-1">
                    {getDocTitle(item)}
                  </h4>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {getCleanDocContent(item).replace(/[#*`]/g, '')}
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Full Markdown Doc Viewer */}
          <div className="md:col-span-7 flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden elevation-1">
            {selectedDoc ? (
              <div className="flex flex-col h-full">
                <div className="p-5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-primary font-mono mb-0.5 uppercase">
                        {selectedDoc.chunk?.category || selectedDoc.category || 'مستند لیارا'}
                      </div>
                      <h3 className="text-sm font-bold text-foreground">
                        {getDocTitle(selectedDoc)}
                      </h3>
                    </div>

                    {(selectedDoc.chunk?.original_url || selectedDoc.original_url) && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={selectedDoc.chunk?.original_url || selectedDoc.original_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>مشاهده در سایت</span>
                          <LuExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <div
                  className="flex-1 overflow-y-auto p-5 markdown-body text-xs md:text-sm text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(getCleanDocContent(selectedDoc)),
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center py-20">
                <div>
                  <LuBookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-xs text-muted-foreground">
                    یک مستند را از لیست انتخاب کنید تا متن کامل آن نمایش داده شود.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

