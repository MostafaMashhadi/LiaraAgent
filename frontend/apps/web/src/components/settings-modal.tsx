import React, { useState, useEffect } from 'react'
import {
  LuX,
  LuSettings,
  LuMoon,
  LuSun,
  LuMonitor,
  LuUser,
  LuTrash2,
  LuCheck,
  LuSparkles,
  LuDatabase,
  LuLogOut,
  LuLogIn,
  LuSlidersHorizontal,
  LuInfo,
} from 'react-icons/lu'
import { useTheme, type Theme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { LiaraUser } from '@/types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  currentUser: LiaraUser | null
  onOpenAuth: () => void
  onLogout: () => void
  onClearAllSessions?: () => void
}

export function SettingsModal({
  open,
  onClose,
  currentUser,
  onOpenAuth,
  onLogout,
  onClearAllSessions,
}: SettingsModalProps) {
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'account' | 'data' | 'about'>('general')

  // AI model preferences stored in localStorage
  const [aiTemperature, setAiTemperature] = useState(() => {
    try {
      return localStorage.getItem('liara_ai_temp') || '0.7'
    } catch {
      return '0.7'
    }
  })

  const [streamEnabled, setStreamEnabled] = useState(() => {
    try {
      return localStorage.getItem('liara_ai_stream') !== 'false'
    } catch {
      return true
    }
  })

  const [codeFontSize, setCodeFontSize] = useState(() => {
    try {
      return localStorage.getItem('liara_code_font_size') || 'medium'
    } catch {
      return 'medium'
    }
  })

  const [savedSuccess, setSavedSuccess] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleSaveAiSettings = () => {
    try {
      localStorage.setItem('liara_ai_temp', aiTemperature)
      localStorage.setItem('liara_ai_stream', String(streamEnabled))
      localStorage.setItem('liara_code_font_size', codeFontSize)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleClearHistory = () => {
    if (onClearAllSessions) {
      onClearAllSessions()
    } else {
      try {
        localStorage.removeItem('liara_sessions')
      } catch {
        // ignore
      }
    }
    setConfirmClear(false)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  const navItems = [
    { id: 'general', label: 'عمومی و ظاهر', icon: LuSettings },
    { id: 'ai', label: 'مدل و هوش مصنوعی', icon: LuSparkles },
    { id: 'account', label: 'حساب کاربری', icon: LuUser },
    { id: 'data', label: 'داده‌ها و حافظه', icon: LuDatabase },
    { id: 'about', label: 'درباره دستیار', icon: LuInfo },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-2xl overflow-hidden elevation-5 shadow-2xl flex flex-col max-h-[90vh] z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <LuSlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">تنظیمات دستیار هوشمند</h2>
              <p className="text-[11px] text-muted-foreground">شخصی‌سازی ظاهر، مدل هوش مصنوعی و حساب کاربری</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="بستن پنجره"
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Body (Navigation + Content) */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 min-h-0 overflow-hidden">
          {/* Sidebar Nav */}
          <nav className="sm:col-span-4 p-2 sm:p-3 border-b sm:border-b-0 sm:border-l border-border bg-muted/20 space-y-1 overflow-x-auto sm:overflow-y-auto flex sm:flex-col shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap sm:w-full justify-start',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Tab Content Panel */}
          <div className="sm:col-span-8 p-4 sm:p-6 overflow-y-auto space-y-5">
            {/* 1. General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-5 animate-in fade-in-50 duration-150">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    پوسته و تم رابط کاربری
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    تم تاریک یا روشن متناسب با سلیقه شما یا تنظیمات سیستم‌عامل
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 'light', label: 'روشن', icon: LuSun },
                      { val: 'dark', label: 'تاریک', icon: LuMoon },
                      { val: 'system', label: 'سیستم', icon: LuMonitor },
                    ].map((opt) => {
                      const Icon = opt.icon
                      const isSelected = theme === opt.val
                      return (
                        <button
                          key={opt.val}
                          onClick={() => setTheme(opt.val as Theme)}
                          className={cn(
                            'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/30'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    اندازه فونت کدهای خروجی
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    اندازه نمایش قطعه‌کدها در پاسخ‌های دستیار و مستندات
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 'small', label: 'کوچک (۱۲px)' },
                      { val: 'medium', label: 'متوسط (۱۳px)' },
                      { val: 'large', label: 'بزرگ (۱۴px)' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setCodeFontSize(opt.val)
                          localStorage.setItem('liara_code_font_size', opt.val)
                        }}
                        className={cn(
                          'p-2.5 rounded-xl border text-xs font-medium transition-all text-center',
                          codeFontSize === opt.val
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. AI Model Tab */}
            {activeTab === 'ai' && (
              <div className="space-y-5 animate-in fade-in-50 duration-150">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    میزان خلاقیت مدل (Temperature)
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    تنظیم دقت فنی یا خلاقیت در پاسخ‌های هوش مصنوعی
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: '0.2', label: 'دقیق و فنی', desc: 'مناسب کانفیگ و لاگ' },
                      { val: '0.7', label: 'متعادل (پیش‌فرض)', desc: 'پاسخ‌های استاندارد' },
                      { val: '1.0', label: 'توضیحی و خلاق', desc: 'توضیحات مفصل‌تر' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => setAiTemperature(opt.val)}
                        className={cn(
                          'p-2.5 rounded-xl border text-right transition-all flex flex-col gap-0.5',
                          aiTemperature === opt.val
                            ? 'border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary/30'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <span className="text-xs font-semibold">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-foreground block">
                      پاسخ‌دهی استریم بلادرنگ (Streaming)
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      دریافت پاسخ‌ها به صورت جریانی و کلمه به کلمه
                    </p>
                  </div>
                  <button
                    onClick={() => setStreamEnabled(!streamEnabled)}
                    role="switch"
                    aria-checked={streamEnabled}
                    className={cn(
                      'w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5',
                      streamEnabled ? 'bg-primary' : 'bg-muted border border-border'
                    )}
                  >
                    <span
                      className={cn(
                        'block w-5 h-5 rounded-full bg-white transition-transform shadow-sm',
                        streamEnabled ? 'translate-x-0' : '-translate-x-5'
                      )}
                    />
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveAiSettings}
                    className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {savedSuccess ? (
                      <>
                        <LuCheck className="w-4 h-4" />
                        <span>تنظیمات ذخیره شد</span>
                      </>
                    ) : (
                      <span>ذخیره تنظیمات هوش مصنوعی</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 3. Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                {currentUser ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-lg font-bold shrink-0">
                        {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {currentUser.name || 'کاربر بدون نام'}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {currentUser.role === 'admin' ? 'مدیر سیستم' : 'توسعه‌دهنده'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate" dir="ltr">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">شناسه کاربری:</span>
                        <span className="font-mono text-foreground">{currentUser.id}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">وضعیت دسترسی:</span>
                        <span className="text-emerald-500 font-medium">احراز هویت شده</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => {
                          onLogout()
                          onClose()
                        }}
                        className="w-full h-9 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <LuLogOut className="w-4 h-4" />
                        <span>خروج از حساب کاربری</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                      <LuUser className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">حالت کاربر مهمان</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                        برای دسترسی به سوابق گفتگوها در دیتابیس ابری، مدیریت دامنه‌ها و امکانات پیشرفته وارد شوید.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onClose()
                        onOpenAuth()
                      }}
                      className="px-6 h-9 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2 shadow-sm"
                    >
                      <LuLogIn className="w-4 h-4" />
                      <span>ورود یا ثبت‌نام در سامانه</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 4. Data & Storage Tab */}
            {activeTab === 'data' && (
              <div className="space-y-4 animate-in fade-in-50 duration-150">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    مدیریت داده‌ها و سوابق حافظه
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    پاکسازی سوابق محلی گفتگوها یا بازنشانی کش برنامه
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">پاکسازی تمام گفتگوها</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      حذف تاریخچه گفتگوهای جاری از حافظه محلی مرورگر
                    </p>
                  </div>
                  {confirmClear ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleClearHistory}
                        className="px-2.5 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90"
                      >
                        تایید حذف
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        className="px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted"
                      >
                        انصراف
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClear(true)}
                      className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <LuTrash2 className="w-3.5 h-3.5" />
                      <span>پاکسازی</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 5. About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-4 text-xs animate-in fade-in-50 duration-150">
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">دستیار هوشمند سکوی ابری لیارا</h3>
                      <p className="text-[10px] text-muted-foreground font-mono">نسخه ۲.۴.۰ — پایدار</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                    طراحی‌شده برای تسهیل استقرار سرویس‌ها، تولید فایل‌های کانفیگ liara.json و Dockerfile، عیب‌یابی لاگ‌ها و پاسخ به سوالات توسعه‌دهندگان بر پایه هوش مصنوعی.
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <p className="font-semibold text-foreground text-xs mb-1.5">کلیدهای میانبر سریع:</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-muted/20 border border-border flex justify-between">
                      <span className="text-muted-foreground">ارسال پیام:</span>
                      <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">Enter</kbd>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/20 border border-border flex justify-between">
                      <span className="text-muted-foreground">خط جدید:</span>
                      <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">Shift + Enter</kbd>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/20 border border-border flex justify-between">
                      <span className="text-muted-foreground">جستجوی مستندات:</span>
                      <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">Ctrl + K</kbd>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/20 border border-border flex justify-between">
                      <span className="text-muted-foreground">بستن پنجره:</span>
                      <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px]">Esc</kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
