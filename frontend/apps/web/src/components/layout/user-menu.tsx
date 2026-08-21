import React, { useState, useRef, useEffect } from 'react'
import {
  LuUser,
  LuSettings,
  LuLogOut,
  LuLogIn,
  LuShield,
  LuChevronDown,
} from 'react-icons/lu'
import { cn } from '@/lib/utils'
import { LiaraUser } from '@/types'

interface UserMenuProps {
  currentUser: LiaraUser | null
  onOpenAuth: () => void
  onLogout: () => void
  onOpenSettings: () => void
  onNavigateTab?: (tab: string) => void
}

export function UserMenu({
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenSettings,
  onNavigateTab,
}: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      {currentUser ? (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="منوی حساب کاربری"
          title={currentUser.name || currentUser.email}
          className={cn(
            'flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-full border transition-all duration-150',
            open
              ? 'border-primary/50 bg-primary/10 shadow-sm'
              : 'border-border bg-card hover:bg-muted hover:border-primary/30'
          )}
        >
          <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary text-xs font-bold shrink-0 shadow-sm">
            {currentUser.name ? currentUser.name.charAt(0) : 'U'}
          </div>
          <span className="text-xs font-medium text-foreground max-w-[100px] truncate hidden md:inline">
            {currentUser.name || currentUser.email.split('@')[0]}
          </span>
          <LuChevronDown
            className={cn(
              'w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 hidden sm:inline',
              open && 'rotate-180 text-foreground'
            )}
          />
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenAuth}
            className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            <LuLogIn className="w-3.5 h-3.5" />
            <span>ورود</span>
          </button>
        </div>
      )}

      {/* Popover Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute top-full mt-2 left-0 w-64 rounded-2xl border border-border bg-popover/95 backdrop-blur-xl p-2 elevation-4 shadow-2xl z-50 origin-top-left animate-in fade-in zoom-in-95 duration-150"
        >
          {currentUser ? (
            <>
              {/* User Header Profile Card */}
              <div
                onClick={() => {
                  onOpenSettings()
                  setOpen(false)
                }}
                className="p-3 rounded-xl bg-muted/50 border border-border/60 mb-2 cursor-pointer hover:bg-muted/80 transition-colors"
                title="مشاهده پروفایل در تنظیمات"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary text-sm font-bold shrink-0 shadow-sm">
                    {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {currentUser.name || 'کاربر بدون نام'}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate" dir="ltr">
                      {currentUser.email}
                    </p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      {currentUser.role === 'admin' ? 'مدیر سیستم' : 'کاربر توسعه‌دهنده'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1 text-xs">
                <button
                  onClick={() => {
                    onOpenSettings()
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-muted hover:text-primary transition-colors text-right"
                >
                  <LuSettings className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">تنظیمات و شخصی‌سازی</span>
                </button>

                {currentUser.role === 'admin' && onNavigateTab && (
                  <button
                    onClick={() => {
                      onNavigateTab('admin')
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-foreground hover:bg-muted hover:text-primary transition-colors text-right"
                  >
                    <LuShield className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">پنل مدیریت سیستم</span>
                  </button>
                )}

                <div className="my-1 border-t border-border" />

                <button
                  onClick={() => {
                    onLogout()
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors text-right font-medium"
                >
                  <LuLogOut className="w-4 h-4" />
                  <span>خروج از حساب</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-2 space-y-2 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-border">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <LuUser className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">کاربر مهمان</p>
                  <p className="text-[10px] text-muted-foreground">ورود برای همگام‌سازی ابری</p>
                </div>
              </div>

              <button
                onClick={() => {
                  onOpenAuth()
                  setOpen(false)
                }}
                className="w-full h-8 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-1.5 shadow-sm"
              >
                <LuLogIn className="w-3.5 h-3.5" />
                <span>ورود / ثبت‌نام</span>
              </button>

              <button
                onClick={() => {
                  onOpenSettings()
                  setOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-foreground hover:bg-muted transition-colors text-right"
              >
                <LuSettings className="w-4 h-4 text-muted-foreground" />
                <span>تنظیمات دستیار</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
