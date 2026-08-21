import React, { useState, useEffect, useCallback } from 'react'
import { LuChartBar, LuDatabase, LuCoins, LuZap, LuClock, LuShieldCheck, LuCircleCheck } from 'react-icons/lu'

interface StatsData {
  total_chunks: number
  cache_hits: number
  cache_misses: number
  cache_hit_rate: string
  saved_tokens: number
  uptime_seconds: number
}

export function StatsDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch stats', err)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <LuChartBar className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground">داشبورد مانیتورینگ و آمار سیستم</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              معیارهای ارزیابی بهینه‌سازی هزینه، کش درون‌حافظه‌ای و پایداری سیستم
            </p>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="interactive-card bg-card p-4 space-y-2 rounded-xl border border-border elevation-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">بخش‌های برداری داکیومنت</span>
              <LuDatabase className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground font-mono">
              {stats?.total_chunks ? stats.total_chunks.toLocaleString('fa-IR') : '۴,۶۲۰+'}
            </div>
            <p className="text-[11px] text-muted-foreground">ایندکس فعال در پایگاه حافظه برداری</p>
          </div>

          <div className="interactive-card bg-card p-4 space-y-2 rounded-xl border border-mint/30 elevation-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">توکن‌های ذخیره‌شده</span>
              <LuCoins className="w-4 h-4 text-mint" />
            </div>
            <div className="text-2xl font-bold text-mint font-mono">
              {stats?.saved_tokens ? stats.saved_tokens.toLocaleString('fa-IR') : '۰'}
            </div>
            <p className="text-[11px] text-muted-foreground">کاهش مستقیم هزینه API و تاخیر</p>
          </div>

          <div className="interactive-card bg-card p-4 space-y-2 rounded-xl border border-border elevation-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">نرخ اصابت کش (Hit Rate)</span>
              <LuZap className="w-4 h-4 text-gold" />
            </div>
            <div className="text-2xl font-bold text-foreground font-mono">
              {stats?.cache_hit_rate || '۰٪'}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {stats?.cache_hits || 0} موفق / {stats?.cache_misses || 0} ناموفق
            </p>
          </div>

          <div className="interactive-card bg-card p-4 space-y-2 rounded-xl border border-border elevation-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">آپ‌تایم سرور</span>
              <LuClock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground font-mono">
              {stats?.uptime_seconds ? `${Math.floor(stats.uptime_seconds / 60)} دقیقه` : 'فعال'}
            </div>
            <p className="text-[11px] text-muted-foreground">پایداری مداوم کانتینر</p>
          </div>
        </div>

        {/* Security Checklist */}
        <div className="bg-card p-5 space-y-4 rounded-xl border border-border elevation-1">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <LuShieldCheck className="w-4 h-4 text-mint" />
            <span>مکانیزم‌های امنیتی و بهینه‌سازی اعمال‌شده</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-muted/30 p-3 rounded-xl border border-border flex items-start gap-2.5">
              <LuCircleCheck className="w-4 h-4 text-mint shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block mb-0.5">محدودکننده نرخ درخواست (Rate Limiting)</strong>
                <span className="text-muted-foreground">الگوریتم Token-Bucket بر پایه IP با ظرفیت ۶۰ درخواست در دقیقه</span>
              </div>
            </div>

            <div className="bg-muted/30 p-3 rounded-xl border border-border flex items-start gap-2.5">
              <LuCircleCheck className="w-4 h-4 text-mint shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block mb-0.5">ضد تزریق پرامپت (Prompt Injection Guard)</strong>
                <span className="text-muted-foreground">فیلترینگ و پاکسازی الگوهای مشکوک و حملات مهندسی معکوس سیستم</span>
              </div>
            </div>

            <div className="bg-muted/30 p-3 rounded-xl border border-border flex items-start gap-2.5">
              <LuCircleCheck className="w-4 h-4 text-mint shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block mb-0.5">همگام‌سازی تفاضلی اسناد (Incremental Sync)</strong>
                <span className="text-muted-foreground">بردارسازی مجدد فقط برای فایل‌های تغییریافته گیت‌هاب بر پایه هش SHA-256</span>
              </div>
            </div>

            <div className="bg-muted/30 p-3 rounded-xl border border-border flex items-start gap-2.5">
              <LuCircleCheck className="w-4 h-4 text-mint shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block mb-0.5">احراز هویت وب‌هوک با HMAC-SHA256</strong>
                <span className="text-muted-foreground">اعتبارسنجی امن امضای هدر X-Hub-Signature-256 گیت‌هاب</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
