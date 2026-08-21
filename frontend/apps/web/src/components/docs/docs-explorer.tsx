import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  LuSearch,
  LuBookOpen,
  LuExternalLink,
  LuLayers,
  LuDatabase,
  LuSparkles,
  LuBoxes,
  LuHardDrive,
  LuMail,
  LuGlobe,
  LuServer,
  LuTerminal,
  LuCopy,
  LuCheck,
  LuTag,
  LuFileText,
  LuFilter,
  LuX,
  LuArrowRight,
  LuList,
  LuChevronDown,
} from 'react-icons/lu'
import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Card } from '@workspace/ui/components/card'
import { Badge } from '@workspace/ui/components/badge'
import { DocChunk, DocResult } from '@/types'

export interface CategoryMeta {
  id: string
  label: string
  shortLabel: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  badgeClass: string
}

const CATEGORY_MAP: Record<string, CategoryMeta> = {
  paas: {
    id: 'paas',
    label: 'پلتفرم‌ها (PaaS)',
    shortLabel: 'PaaS',
    description: 'استقرار و مدیریت برنامه‌های Node.js, Python, PHP, Go, Docker, Django و ...',
    icon: LuLayers,
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400',
  },
  dbaas: {
    id: 'dbaas',
    label: 'دیتابیس‌ها (DBaaS)',
    shortLabel: 'DBaaS',
    description: 'پایگاه‌های داده ابری مدیریت شده PostgreSQL, MySQL, Redis, MongoDB و ...',
    icon: LuDatabase,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400',
  },
  ai: {
    id: 'ai',
    label: 'هوش مصنوعی (AI)',
    shortLabel: 'AI',
    description: 'سرویس هوش مصنوعی، مدل‌های زبانی بزرگ، LLM و APIهای هوش مصنوعی',
    icon: LuSparkles,
    badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400',
  },
  'one-click-apps': {
    id: 'one-click-apps',
    label: 'برنامه‌های آماده',
    shortLabel: 'برنامه‌ها',
    description: 'وردپرس، متامیس، کملیو، گوست و سایر ابزارهای تک‌کلیکه',
    icon: LuBoxes,
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400',
  },
  'object-storage': {
    id: 'object-storage',
    label: 'ذخیره‌سازی ابری (S3)',
    shortLabel: 'ذخیره‌سازی S3',
    description: 'باکت‌های ذخیره‌سازی اشیاء سازگار با پروتکل استاندارد AWS S3',
    icon: LuHardDrive,
    badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:bg-cyan-500/20 dark:text-cyan-400',
  },
  'email-server': {
    id: 'email-server',
    label: 'سرور ایمیل',
    shortLabel: 'ایمیل',
    description: 'ارسال و دریافت ایمیل‌های سازمانی و تراکنشی با امنیت بالا',
    icon: LuMail,
    badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400',
  },
  'dns-management-system': {
    id: 'dns-management-system',
    label: 'دامنه و DNS',
    shortLabel: 'دامنه و DNS',
    description: 'مدیریت رکوردهای DNS، اتصال دامنه اختصاصی و گواهی رایگان SSL',
    icon: LuGlobe,
    badgeClass: 'bg-teal-500/10 text-teal-600 border-teal-500/20 dark:bg-teal-500/20 dark:text-teal-400',
  },
  iaas: {
    id: 'iaas',
    label: 'سرور ابری (IaaS)',
    shortLabel: 'IaaS',
    description: 'سرورهای مجازی ابری با منابع اختصاصی و ترافیک بالا',
    icon: LuServer,
    badgeClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400',
  },
  references: {
    id: 'references',
    label: 'منابع و CLI',
    shortLabel: 'CLI و منابع',
    description: 'دستورات Liara CLI، مستندات API، متغیرهای سیستمی و راهنماها',
    icon: LuTerminal,
    badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400',
  },
  overview: {
    id: 'overview',
    label: 'شروع و معرفی',
    shortLabel: 'شروع و معرفی',
    description: 'مفاهیم پایه، ثبت‌نام و اولین تجربه کار با لیارا',
    icon: LuBookOpen,
    badgeClass: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400',
  },
  cicd: {
    id: 'cicd',
    label: 'یکپارچه‌سازی (CI/CD)',
    shortLabel: 'CI/CD',
    description: 'اتصال مخازن GitHub، GitLab و استقرار خودکار برنامه‌ها',
    icon: LuTerminal,
    badgeClass: 'bg-pink-500/10 text-pink-600 border-pink-500/20 dark:bg-pink-500/20 dark:text-pink-400',
  },
  general: {
    id: 'general',
    label: 'عمومی',
    shortLabel: 'عمومی',
    description: 'مستندات عمومی و راهنماهای کلی لیارا',
    icon: LuFileText,
    badgeClass: 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:bg-slate-500/20 dark:text-slate-400',
  },
}

const PLATFORM_LABELS: Record<string, string> = {
  nodejs: 'Node.js',
  python: 'Python',
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  laravel: 'Laravel',
  php: 'PHP',
  go: 'Go',
  golang: 'Go',
  docker: 'Docker',
  nextjs: 'Next.js',
  react: 'React',
  vue: 'Vue.js',
  angular: 'Angular',
  dotnet: '.NET',
  netcore: '.NET Core',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  redis: 'Redis',
  mongodb: 'MongoDB',
  elasticsearch: 'Elasticsearch',
  wordpress: 'WordPress',
  ghost: 'Ghost',
  metabase: 'Metabase',
  rabbitmq: 'RabbitMQ',
  minio: 'MinIO',
  n8n: 'n8n',
  strapi: 'Strapi',
  pocketbase: 'PocketBase',
  uptime: 'Uptime Kuma',
}

export function getCategoryInfo(catId: string): CategoryMeta {
  const norm = (catId || '').toLowerCase().trim()
  if (CATEGORY_MAP[norm]) {
    return CATEGORY_MAP[norm]
  }
  const noHyphen = norm.replace(/-/g, '')
  if (CATEGORY_MAP[noHyphen]) {
    return CATEGORY_MAP[noHyphen]
  }
  return {
    id: catId,
    label: catId ? catId.charAt(0).toUpperCase() + catId.slice(1).replace(/[-_]/g, ' ') : 'مستند لیارا',
    shortLabel: catId || 'مستند',
    description: 'مستندات و راهنماهای مرتبط',
    icon: LuFileText,
    badgeClass: 'bg-muted text-muted-foreground border-border',
  }
}

export function extractPlatform(filePath?: string, docTitle?: string): string | null {
  if (!filePath && !docTitle) return null
  const combined = `${filePath || ''} ${docTitle || ''}`.toLowerCase()

  for (const [key, label] of Object.entries(PLATFORM_LABELS)) {
    const regex = new RegExp(`(?:/|\\b|_|-)${key}(?:/|\\b|_|-)`, 'i')
    if (regex.test(combined) || combined.includes(`/${key}/`)) {
      return label
    }
  }
  return null
}

interface DocsExplorerProps {
  focusDoc?: DocResult | null
}

export function DocsExplorer({ focusDoc }: DocsExplorerProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [results, setResults] = useState<DocResult[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocResult | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'reader'>('list')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const isInitialMount = useRef(true)

  // Fetch all available category counts from the backend API
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/docs/categories')
      if (res.ok) {
        const data = await res.json()
        if (data.categories && typeof data.categories === 'object') {
          setCategoryCounts(data.categories)
        }
      }
    } catch (err) {
      console.error('Failed to fetch doc categories', err)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Handle focusDoc when navigated from HeaderSearch
  useEffect(() => {
    if (focusDoc) {
      setSelectedDoc(focusDoc)
      setMobileView('reader')
      const chunk = (focusDoc.chunk || focusDoc) as DocChunk
      if (chunk.category) {
        setCategory(chunk.category)
      }
    }
  }, [focusDoc])

  const getDocTitle = (item: DocResult) => {
    if (!item) return 'مستند لیارا'
    const chunk = (item.chunk || item) as DocChunk
    let t = chunk.title || chunk.doc_title || chunk.section_title || ''
    t = t.replace(/<title>|<\/title>|مستندات|لیارا|[-–|]/gi, ' ').trim()
    if (!t || t.trim() === '') {
      if (chunk.file_path) {
        t = chunk.file_path.split('/').pop()!.replace(/\.mdx?$/, '').replace(/[-_]/g, ' ')
      } else {
        t = 'مستند لیارا'
      }
    }
    return t.replace(/^[#\s]+/, '').replace(/####/g, '').trim()
  }

  const getCleanDocContent = (item: DocResult) => {
    if (!item) return ''
    const chunk = (item.chunk || item) as DocChunk
    let body = chunk.raw_body || chunk.content || ''
    body = body.replace(/^Title:\s*.*?\n/i, '')
    body = body.replace(/^Source:\s*.*?\n/i, '')
    body = body.replace(/import\s+.*?;\s*\n?/g, '')
    body = body.replace(/<title>.*?<\/title>/gi, '')
    body = body.replace(/\[####\s+/g, '[')
    body = body.replace(/\[###\s+/g, '[')
    body = body.replace(/\[##\s+/g, '[')
    body = body.replace(/\[#\s+/g, '[')
    body = body.replace(/className=["'][^"']*["']/g, '')
    body = body.replace(/style=\{\{[\s\S]*?\}\}/g, '')
    body = body.replace(/<Step\s+steps=\s*\{\s*\[/gi, '')
    body = body.replace(/step:\s*["']([^"']+)["']\s*,\s*content:\s*\(?/gi, '\n### مرحله $1\n\n')
    body = body.replace(/<Important>(.*?)<\/Important>/gi, ' `$1` ')
    body = body.replace(/\s*\[[\s\S]*?\]\s*\.map\s*\([\s\S]*?\)\s*\}?/g, (match: string) => {
      const links: string[] = []
      const linkRegex = /(?:text|title)\s*:\s*['"]([^'"]+)['"]\s*,\s*link\s*:\s*['"]([^'"]+)['"]/g
      let m
      while ((m = linkRegex.exec(match)) !== null) {
        links.push(`- [${m[1].trim()}](${m[2].trim()})`)
      }
      return links.length > 0 ? '\n' + links.join('\n') + '\n' : ''
    })
    body = body.replace(/<Alert(?:\s+variant=['"][^'"]*['"])?>([\s\S]*?)<\/Alert>/gi, (_, alertContent: string) => {
      const cleanAlert = alertContent
        .replace(/<(?:Link|a)\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/(?:Link|a)>/gi, (_, h: string, t: string) => `[${t.replace(/\s+/g, ' ').trim()}](${h.trim()})`)
        .trim()
      const lines = cleanAlert.split('\n').map((l: string) => l.trim()).filter(Boolean)
      return '\n> **نکته:**\n' + lines.map((l: string) => '> ' + l).join('\n') + '\n\n'
    })
    body = body.replace(/<(?:Link|a)\s+[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/(?:Link|a)>/gi, (_, href: string, text: string) => {
      const cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      const cleanHref = href.trim()
      return cleanText && cleanHref ? ` [${cleanText}](${cleanHref}) ` : ''
    })
    body = body.replace(/<\/?[A-Z][a-zA-Z0-9_]*[^>]*>/g, '')
    body = body.replace(/key=\{?[^}]*\}?/g, '')
    body = body.replace(/href=\{?[^}]*\}?/g, '')
    body = body.replace(/\[?\s*\(?(?:item|platform|data)\s*,\s*index\)?\s*=>\s*\(?/g, '')
    body = body.replace(/\)?\s*=>\s*\(?/g, '')
    body = body.replace(/\{text:\s*/g, '')
    body = body.replace(/\}\s*\]\s*\}?\s*\/?>/g, '')
    body = body.replace(/\/\s*>/g, '')
    body = body.replace(/^\s*[()[\]{}=><,;:/\\]+\s*$/gm, '')
    body = body.replace(/^\s*\*\*\s*$/gm, '')
    body = body.replace(/\n{3,}/g, '\n\n')
    return body.trim()
  }

  // Calculate total chunk count across all categories
  const totalCount = useMemo(() => {
    return Object.values(categoryCounts).reduce((acc, c) => acc + c, 0)
  }, [categoryCounts])

  // Build the complete dynamic category list
  const fullCategoriesList = useMemo(() => {
    const list: Array<{ id: string; meta: CategoryMeta; count: number }> = [
      {
        id: '',
        meta: {
          id: '',
          label: 'همه مستندات',
          shortLabel: 'همه',
          description: 'مشاهده تمام بخش‌ها و راهنماهای لیارا',
          icon: LuBookOpen,
          badgeClass: 'bg-primary/10 text-primary border-primary/20',
        },
        count: totalCount,
      },
    ]

    // Predefined order
    const orderedKeys = [
      'paas',
      'dbaas',
      'ai',
      'one-click-apps',
      'object-storage',
      'email-server',
      'dns-management-system',
      'iaas',
      'references',
      'overview',
      'cicd',
      'general',
    ]

    const seen = new Set<string>()

    for (const key of orderedKeys) {
      const count = categoryCounts[key] || 0
      list.push({
        id: key,
        meta: getCategoryInfo(key),
        count,
      })
      seen.add(key)
    }

    // Add any unexpected backend categories
    for (const [key, count] of Object.entries(categoryCounts)) {
      if (!seen.has(key)) {
        list.push({
          id: key,
          meta: getCategoryInfo(key),
          count,
        })
      }
    }

    return list
  }, [categoryCounts, totalCount])

  // Responsive category list: shows top categories + expands cleanly without horizontal scrollbars
  const displayedCategories = useMemo(() => {
    if (showAllCategories || fullCategoriesList.length <= 8) {
      return fullCategoriesList
    }
    const top = fullCategoriesList.slice(0, 8)
    if (category && !top.some((c) => c.id === category)) {
      const active = fullCategoriesList.find((c) => c.id === category)
      if (active) top.push(active)
    }
    return top
  }, [fullCategoriesList, showAllCategories, category])

  const searchDocs = useCallback(async (searchQuery: string, cat: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append('q', searchQuery)
      if (cat) params.append('category', cat)
      params.append('limit', '500')

      const res = await fetch(`/api/docs/search?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const fetchedResults: DocResult[] = data.results || []
        setResults(fetchedResults)

        if (data.categories && typeof data.categories === 'object') {
          setCategoryCounts((prev) => ({ ...prev, ...data.categories }))
        }

        // Maintain selection
        setSelectedDoc((currentSelected) => {
          if (focusDoc && isInitialMount.current) {
            return focusDoc
          }
          if (currentSelected) {
            const found = fetchedResults.find(
              (r) =>
                (r.chunk?.id && r.chunk.id === currentSelected.chunk?.id) ||
                (r.id && r.id === currentSelected.id)
            )
            if (found) return found
          }
          return fetchedResults.length > 0 ? fetchedResults[0] : null
        })
      }
    } catch (err) {
      console.error('Failed to search docs', err)
    } finally {
      setIsLoading(false)
      isInitialMount.current = false
    }
  }, [focusDoc])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchDocs(query, category)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, category, searchDocs])

  // Extract platforms available in current results for secondary filtering
  const availablePlatforms = useMemo(() => {
    const platformSet = new Set<string>()
    for (const item of results) {
      const chunk = (item.chunk || item) as DocChunk
      const p = extractPlatform(chunk.file_path, chunk.doc_title || chunk.title)
      if (p) platformSet.add(p)
    }
    return Array.from(platformSet).sort()
  }, [results])

  // Filter results by selected platform if applicable
  const filteredResults = useMemo(() => {
    if (!selectedPlatform) return results
    return results.filter((item) => {
      const chunk = (item.chunk || item) as DocChunk
      const p = extractPlatform(chunk.file_path, chunk.doc_title || chunk.title)
      return p === selectedPlatform
    })
  }, [results, selectedPlatform])

  // Count to display in top badge: reflects total category/library documents when not filtering by text/platform
  const displayDocCount = useMemo(() => {
    if (query.trim() || selectedPlatform) {
      return filteredResults.length
    }
    if (category) {
      return categoryCounts[category] || filteredResults.length
    }
    return totalCount || filteredResults.length
  }, [query, selectedPlatform, category, categoryCounts, filteredResults.length, totalCount])

  const handleCopyContent = () => {
    if (!selectedDoc) return
    const content = getCleanDocContent(selectedDoc)
    navigator.clipboard.writeText(content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const currentCategoryMeta = getCategoryInfo(category)

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-3 md:p-6 bg-background">
      <div className="max-w-7xl w-full mx-auto flex flex-col h-full space-y-4">
        {/* Header & Search Bar */}
        <div className="space-y-3 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                <LuBookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">بانک مستندات و راهنماهای رسمی لیارا</h2>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  جستجو در تمام راهنماها، مفاهیم، دستورات CLI و تنظیمات سرویس‌های ابری
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                <b className="font-mono text-foreground font-bold ml-1">{displayDocCount.toLocaleString('fa-IR')}</b> مستند
              </span>
            </div>
          </div>

          {/* Search Input with quick clear */}
          <div className="relative">
            <LuSearch className="w-4 h-4 text-muted-foreground absolute right-3.5 top-3.5" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در تمام مستندات، راهنماها و تنظیمات لیارا (مثال: متغیرهای محیطی، داکر، پایتون)..."
              className="pr-10 pl-10 rounded-xl bg-card border-border shadow-sm text-xs sm:text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute left-3 top-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
              >
                <LuX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Section */}
          <div className="space-y-2 pt-0.5">
            {/* Primary Categories: Sleek single-row scroll on mobile, wrap pills on desktop */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none sm:flex-wrap py-0.5 select-none -mx-1 px-1 sm:mx-0 sm:px-0">
              {displayedCategories.map((cat) => {
                const isActive = category === cat.id
                const Icon = cat.meta.icon
                return (
                  <button
                    key={cat.id || 'all'}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id)
                      setSelectedPlatform(null)
                    }}
                    className={cn(
                      'inline-flex items-center shrink-0 gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium border transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap',
                      isActive
                        ? 'bg-primary text-primary-foreground border-transparent shadow-xs ring-1 sm:ring-2 ring-primary/20 font-bold'
                        : 'bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted hover:border-primary/30'
                    )}
                  >
                    <Icon className={cn('w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0', isActive ? 'text-primary-foreground' : 'text-primary')} />
                    <span className="sm:inline hidden">{cat.meta.label}</span>
                    <span className="sm:hidden inline">{cat.meta.shortLabel || cat.meta.label}</span>
                    {cat.count > 0 && (
                      <span
                        className={cn(
                          'font-mono text-[9px] sm:text-[10px] px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded-full',
                          isActive
                            ? 'bg-primary-foreground/20 text-primary-foreground font-bold'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {cat.count}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Show More / Less Toggle Button if more categories exist */}
              {fullCategoriesList.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="inline-flex items-center shrink-0 gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/40 hover:bg-muted/40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LuChevronDown className={cn('w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-200', showAllCategories && 'rotate-180')} />
                  <span>{showAllCategories ? 'کمتر' : `سایر (${fullCategoriesList.length - 8})`}</span>
                </button>
              )}

              {/* Clear Category Filter if active */}
              {category !== '' && (
                <button
                  type="button"
                  onClick={() => {
                    setCategory('')
                    setSelectedPlatform(null)
                  }}
                  className="inline-flex items-center shrink-0 gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors cursor-pointer whitespace-nowrap"
                  title="حذف فیلتر دسته‌بندی"
                >
                  <LuX className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>حذف فیلتر</span>
                </button>
              )}
            </div>

            {/* Subcategory / Platform Chips (if present) */}
            {availablePlatforms.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-muted/40 border border-border/60 text-[10px] sm:text-[11px] select-none overflow-x-auto scrollbar-none sm:flex-wrap -mx-1 px-1 sm:mx-0 sm:px-2">
                <span className="text-muted-foreground flex items-center gap-1 shrink-0 text-[10px] sm:text-[11px] font-semibold pl-1">
                  <LuFilter className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                  پلتفرم‌ها:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPlatform(null)}
                  className={cn(
                    'px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0',
                    selectedPlatform === null
                      ? 'bg-card text-foreground border border-border shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  همه
                </button>
                {availablePlatforms.map((plat) => {
                  const isSelected = selectedPlatform === plat
                  return (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setSelectedPlatform(isSelected ? null : plat)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs transition-all font-medium cursor-pointer whitespace-nowrap shrink-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                          : 'bg-card/70 border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <LuTag className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                      <span>{plat}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mobile View Toggle Bar */}
        <div className="flex md:hidden items-center bg-muted/80 p-1 rounded-xl gap-1 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setMobileView('list')}
            className={cn(
              'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
              mobileView === 'list'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LuList className="w-3.5 h-3.5" />
            <span>فهرست ({displayDocCount.toLocaleString('fa-IR')})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView('reader')}
            disabled={!selectedDoc}
            className={cn(
              'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40',
              mobileView === 'reader'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LuFileText className="w-3.5 h-3.5" />
            <span>متن مستند</span>
          </button>
        </div>

        {/* Explorer Content Split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-0">
          {/* Results List (Left side on Desktop, List tab on Mobile) */}
          <div
            className={cn(
              'md:col-span-5 flex-col h-full overflow-y-auto space-y-2 pr-1 scrollbar-thin',
              mobileView === 'reader' ? 'hidden md:flex' : 'flex'
            )}
          >
            {isLoading && (
              <div className="text-center py-12 text-xs text-muted-foreground flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>در حال جستجو در پایگاه دانش لیارا...</span>
              </div>
            )}

            {!isLoading && filteredResults.length === 0 && (
              <div className="text-center py-16 px-4 text-xs text-muted-foreground bg-card border border-border rounded-2xl elevation-1 space-y-3">
                <LuBookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="font-bold text-foreground">مستندی با این مشخصات یافت نشد.</p>
                <p className="text-[11px]">
                  می‌توانید عبارت جستجو را تغییر دهید یا دسته‌بندی «همه مستندات» را انتخاب نمایید.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery('')
                      setCategory('')
                      setSelectedPlatform(null)
                    }}
                    className="rounded-xl text-xs"
                  >
                    پاک کردن فیلترها
                  </Button>
                </div>
              </div>
            )}

            {!isLoading &&
              filteredResults.map((item, idx) => {
                const chunk = (item.chunk || item) as DocChunk
                const isSelected =
                  selectedDoc &&
                  ((selectedDoc.chunk?.id && selectedDoc.chunk.id === chunk.id) ||
                    (selectedDoc.id && selectedDoc.id === chunk.id) ||
                    selectedDoc === item)
                const scorePercent = item.score ? Math.round(item.score * 100) : 0
                const itemCat = getCategoryInfo(chunk.category || '')
                const itemPlatform = extractPlatform(chunk.file_path, chunk.doc_title || chunk.title)

                return (
                  <Card
                    key={chunk.id || idx}
                    onClick={() => {
                      setSelectedDoc(item)
                      setMobileView('reader')
                    }}
                    className={cn(
                      'interactive-card p-3.5 rounded-xl border text-right cursor-pointer transition-all duration-200 elevation-1 hover:elevation-2 relative group',
                      isSelected
                        ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary/30'
                        : 'bg-card border-border hover:border-primary/40 text-foreground'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium border', itemCat.badgeClass)}
                        >
                          {itemCat.shortLabel}
                        </Badge>
                        {itemPlatform && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.2 rounded-md font-mono">
                            {itemPlatform}
                          </Badge>
                        )}
                      </div>
                      {scorePercent > 0 && query && (
                        <span className="text-[10px] font-mono text-primary font-bold shrink-0">
                          {scorePercent}% تطابق
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-foreground line-clamp-1 mb-1 group-hover:text-primary transition-colors">
                      {getDocTitle(item)}
                    </h4>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {getCleanDocContent(item).replace(/[#*`>[\]()]/g, '')}
                    </p>
                  </Card>
                )
              })}
          </div>

          {/* Full Markdown Doc Viewer (Right side on Desktop, Reader tab on Mobile) */}
          <div
            className={cn(
              'md:col-span-7 flex-col h-full bg-card border border-border rounded-2xl overflow-hidden elevation-1',
              mobileView === 'list' ? 'hidden md:flex' : 'flex'
            )}
          >
            {selectedDoc ? (
              <div className="flex flex-col h-full">
                {/* Doc Header */}
                <div className="p-3.5 md:p-5 border-b border-border bg-muted/20">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Mobile Back Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMobileView('list')}
                          className="md:hidden rounded-lg text-xs h-6 px-1.5 gap-1 text-primary hover:bg-primary/10"
                        >
                          <LuArrowRight className="w-3.5 h-3.5" />
                          <span>لیست</span>
                        </Button>

                        {(() => {
                          const chunk = (selectedDoc.chunk || selectedDoc) as DocChunk
                          const catMeta = getCategoryInfo(chunk.category || '')
                          const plat = extractPlatform(chunk.file_path, chunk.doc_title || chunk.title)
                          return (
                            <>
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium border', catMeta.badgeClass)}
                              >
                                {catMeta.label}
                              </Badge>
                              {plat && (
                                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-md font-mono">
                                  {plat}
                                </Badge>
                              )}
                            </>
                          )
                        })()}
                      </div>
                      <h3 className="text-xs sm:text-sm md:text-base font-bold text-foreground leading-snug truncate sm:whitespace-normal">
                        {getDocTitle(selectedDoc)}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyContent}
                        title="کپی متن مستند"
                        className="rounded-xl text-xs h-7 sm:h-8 px-2 sm:px-2.5 gap-1 sm:gap-1.5"
                      >
                        {isCopied ? (
                          <>
                            <LuCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500 text-[10px] sm:text-[11px]">کپی شد</span>
                          </>
                        ) : (
                          <>
                            <LuCopy className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] sm:text-[11px] hidden sm:inline">کپی متن</span>
                          </>
                        )}
                      </Button>

                      {((selectedDoc.chunk as DocChunk | undefined)?.original_url || selectedDoc.original_url) && (
                        <Button variant="default" size="sm" asChild className="rounded-xl text-xs h-7 sm:h-8 px-2.5 sm:px-3 gap-1 sm:gap-1.5">
                          <a
                            href={(selectedDoc.chunk as DocChunk | undefined)?.original_url || selectedDoc.original_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="hidden sm:inline">مشاهده در سایت</span>
                            <span className="sm:hidden">سایت</span>
                            <LuExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Doc Body */}
                <div
                  className="flex-1 overflow-y-auto p-3.5 md:p-6 markdown-body text-xs md:text-sm text-foreground leading-relaxed scrollbar-thin"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(getCleanDocContent(selectedDoc)),
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
                  <LuBookOpen className="w-8 h-8 opacity-60" />
                </div>
                <div className="max-w-sm space-y-1">
                  <h4 className="text-sm font-bold text-foreground">
                    {currentCategoryMeta.label}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    یک مستند را از لیست سمت راست انتخاب کنید تا راهنما، کدها و توضیحات کامل آن نمایش داده شود.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
