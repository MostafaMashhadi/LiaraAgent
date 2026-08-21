import React, { useState, useRef, useEffect } from 'react'
import { LuSun, LuMoon, LuMonitor, LuCheck } from 'react-icons/lu'
import { useTheme, type Theme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
}

const OPTIONS: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  { value: 'light', label: 'روشن', icon: <LuSun className="w-4 h-4" /> },
  { value: 'dark', label: 'تاریک', icon: <LuMoon className="w-4 h-4" /> },
  { value: 'system', label: 'سیستم', icon: <LuMonitor className="w-4 h-4" /> },
]

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const activeIcon = OPTIONS.find((o) => o.value === theme)?.icon

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="تغییر تم"
        title="تغییر تم"
        className={cn(
          'h-10 w-10 md:h-8 md:w-8 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors',
          open ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {activeIcon}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="انتخاب تم"
          className="absolute top-full mt-2 left-0 min-w-[130px] rounded-xl border border-border bg-popover p-1 elevation-3 z-50 origin-top-left animate-in fade-in zoom-in-95 duration-100"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="menuitemradio"
              aria-checked={theme === opt.value}
              onClick={() => {
                setTheme(opt.value)
                setOpen(false)
              }}
              className={cn(
                'min-h-11 w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors',
                theme === opt.value
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="shrink-0">{opt.icon}</span>
              <span className="flex-1 text-right">{opt.label}</span>
              {theme === opt.value && <LuCheck className="w-3.5 h-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
