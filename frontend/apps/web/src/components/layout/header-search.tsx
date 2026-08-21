import React, { useState, useEffect, useRef, useCallback } from 'react'
import { LuSearch, LuBookOpen, LuLoader, LuArrowUpDown, LuCornerDownLeft } from 'react-icons/lu'
import { cn } from '@/lib/utils'
import type { DocResult, DocChunk } from '@/types'

interface HeaderSearchProps {
  onSelectDoc: (doc: DocResult) => void
}

function getDocTitle(item: DocResult): string {
  const chunk = (item.chunk || item) as DocChunk
  let t = chunk.title || chunk.doc_title || chunk.section_title || ''
  t = t.replace(/<title>|<\/title>|مستندات|لیارا|[-–|]/gi, ' ').trim()
  if (!t || t.trim() === '') {
    if (chunk.file_path) {
      t = chunk.file_path.split('/').pop()!.replace(/\.mdx?$/, '').replace(/[-_]/g, ' ')
    } else {
      return 'مستند لیارا'
    }
  }
  return t.replace(/^[#\s]+/, '').replace(/####/g, '').trim()
}

function getSnippet(item: DocResult): string {
  const chunk = (item.chunk || item) as DocChunk
  const body = (chunk.raw_body || chunk.content || '')
    .replace(/[#*`>[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return body.slice(0, 140)
}

export function HeaderSearch({ onSelectDoc }: HeaderSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DocResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const runSearch = useCallback(async (q: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/docs/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults((data.results || []).slice(0, 8))
        setHighlight(0)
      }
    } catch {
      // ignore search errors
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const timer = setTimeout(() => runSearch(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query, runSearch])

  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mobileOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 100)
    }
  }, [mobileOpen])

  const choose = (item: DocResult | undefined) => {
    if (!item) return
    onSelectDoc(item)
    setOpen(false)
    setMobileOpen(false)
    setQuery('')
    setResults([])
    inputRef.current?.blur()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setMobileOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[highlight])
    }
  }

  const showPanel = open && query.trim().length >= 2

  return (
    <>
      {/* Desktop Search Bar */}
      <div ref={rootRef} className="relative w-full max-w-md mx-auto hidden md:block">
        <div className="relative group">
          <LuSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showPanel}
            aria-label="جستجو در مستندات"
            placeholder="جستجو در بانک مستندات لیارا..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="w-full h-9 pr-9 pl-10 rounded-full border border-input bg-muted/50 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring focus:bg-background transition-all"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {isLoading ? (
              <LuLoader className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            ) : (
              query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    inputRef.current?.focus()
                  }}
                  aria-label="پاک کردن جستجو"
                  className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted text-xs leading-none transition-colors"
                >
                  ✕
                </button>
              )
            )}
          </span>
        </div>

        {/* Desktop Suggestions dropdown */}
        {showPanel && (
          <div
            role="listbox"
            aria-label="نتایج مستندات"
            className="absolute top-full mt-2 inset-x-0 rounded-2xl border border-border bg-popover elevation-4 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <div className="max-h-[380px] overflow-y-auto p-1.5 scrollbar-thin">
              {!isLoading && results.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  مستندی برای «{query}» یافت نشد.
                </p>
              )}

              {results.map((item, idx) => {
                const chunk = (item.chunk || item) as DocChunk
                const scorePercent = item.score ? Math.round(item.score * 100) : 0
                return (
                  <button
                    key={(chunk.id as string) || idx}
                    role="option"
                    aria-selected={idx === highlight}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => choose(item)}
                    className={cn(
                      'w-full text-right flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors',
                      idx === highlight ? 'bg-primary/10' : 'hover:bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 w-7 h-7 shrink-0 rounded-lg flex items-center justify-center',
                        idx === highlight ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <LuBookOpen className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 mb-0.5">
                        <span
                          className={cn(
                            'text-xs font-bold truncate',
                            idx === highlight ? 'text-primary' : 'text-foreground'
                          )}
                        >
                          {getDocTitle(item)}
                        </span>
                        {chunk.category && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono uppercase">
                            {chunk.category}
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-muted-foreground line-clamp-1 leading-relaxed">
                        {getSnippet(item)}
                      </span>
                    </span>
                    {scorePercent > 0 && (
                      <span className="shrink-0 text-[10px] text-muted-foreground font-mono mt-1">
                        {scorePercent.toLocaleString('fa-IR')}٪
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {results.length > 0 && (
              <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/40 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <LuArrowUpDown className="w-3 h-3" /> حرکت
                </span>
                <span className="flex items-center gap-1">
                  <LuCornerDownLeft className="w-3 h-3" /> انتخاب
                </span>
                <span className="mr-auto">Esc بستن</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Search Button */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="جستجو در مستندات"
        className="md:hidden h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
      >
        <LuSearch className="w-4 h-4" />
      </button>

      {/* Mobile Search Overlay Modal */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md md:hidden flex flex-col p-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <LuSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو در تمام مستندات لیارا..."
                className="w-full h-10 pr-9 pl-9 rounded-xl border border-input bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="h-10 px-3 text-xs font-semibold text-primary hover:bg-muted rounded-xl transition"
            >
              بستن
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
            {isLoading && (
              <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <LuLoader className="w-4 h-4 animate-spin text-primary" />
                <span>در حال جستجو...</span>
              </div>
            )}

            {!isLoading && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-12">
                مستندی برای «{query}» یافت نشد.
              </p>
            )}

            {!isLoading &&
              results.map((item, idx) => {
                const chunk = (item.chunk || item) as DocChunk
                return (
                  <div
                    key={(chunk.id as string) || idx}
                    onClick={() => choose(item)}
                    className="p-3 rounded-xl bg-card border border-border flex items-start gap-2.5 active:bg-muted cursor-pointer"
                  >
                    <LuBookOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate mb-0.5">
                        {getDocTitle(item)}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {getSnippet(item)}
                      </p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </>
  )
}
