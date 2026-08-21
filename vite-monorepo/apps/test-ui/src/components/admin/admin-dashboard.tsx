import React, { useState, useEffect, useCallback } from 'react'
import {
  LuChartBar,
  LuShieldCheck,
  LuZap,
  LuDatabase,
  LuClock,
  LuRefreshCw,
  LuCircleCheck,
  LuTrendingUp,
  LuActivity,
  LuCoins,
  LuUsers,
  LuLoader,
} from 'react-icons/lu'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'

interface StatsData {
  total_requests: number
  total_tokens: number
  total_prompt_tokens: number
  total_completion_tokens: number
  avg_duration_ms: number
  total_users: number
  estimated_cost_usd: number
  estimated_cost_toman: number
}

interface LogEntry {
  id: string
  endpoint: string
  model: string
  duration_ms: number
  status: string
  total_tokens: number
  created_at: string
}

interface CacheStats {
  total_chunks: number
  cache_hits: number
  cache_misses: number
  cache_hit_rate: string
}

interface AdminDashboardProps {
  authToken: string
}

const fmt = (n: number) => n.toLocaleString('fa-IR')

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs elevation-3" dir="rtl">
      {label != null && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium text-foreground font-mono">{typeof p.value === 'number' ? fmt(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, children, isEmpty }: { title: string; subtitle?: string; children: React.ReactNode; isEmpty?: boolean }) {
  return (
    <div className="bg-card rounded-2xl border border-border elevation-1 p-4 md:p-5 flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 min-h-[220px]" dir="ltr">
        {isEmpty ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <LuChartBar className="w-6 h-6 opacity-40" />
            <span className="text-xs">هنوز داده‌ای ثبت نشده است</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-card p-4 space-y-1.5 rounded-2xl border border-border elevation-1">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-semibold">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-foreground font-mono">{value}</div>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function AdminDashboard({ authToken }: AdminDashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncReport, setSyncReport] = useState<string | null>(null)

  const authHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {}
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`
    return headers
  }, [authToken])

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, logsRes, cacheRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: authHeaders() }),
        fetch('/api/admin/logs?limit=200', { headers: authHeaders() }),
        fetch('/api/stats'),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (logsRes.ok) {
        const data = await logsRes.json()
        setLogs(Array.isArray(data.logs) ? data.logs : [])
      }
      if (cacheRes.ok) setCacheStats(await cacheRes.json())
    } catch (err) {
      console.error('Failed to fetch admin data', err)
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 15000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const triggerSync = async () => {
    setIsSyncing(true)
    setSyncReport(null)
    try {
      const res = await fetch('/api/webhook/sync?sync=true', { method: 'POST', headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setSyncReport(data.report || data.message || 'همگام‌سازی با موفقیت انجام شد')
        fetchAll()
      }
    } catch {
      setSyncReport('خطا در همگام‌سازی')
    } finally {
      setIsSyncing(false)
    }
  }

  /* ---------- derived chart data ---------- */

  // Requests per hour over the last 24h
  const timeline = React.useMemo(() => {
    const buckets = new Map<number, { requests: number; tokens: number; errors: number }>()
    const now = Date.now()
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now - i * 3600_000)
      hourStart.setMinutes(0, 0, 0)
      buckets.set(hourStart.getTime(), { requests: 0, tokens: 0, errors: 0 })
    }
    for (const log of logs) {
      const t = new Date(log.created_at)
      t.setMinutes(0, 0, 0)
      const b = buckets.get(t.getTime())
      if (b) {
        b.requests++
        b.tokens += log.total_tokens || 0
        if (log.status !== 'success') b.errors++
      }
    }
    return Array.from(buckets.entries()).map(([ts, v]) => ({
      time: new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      ...v,
    }))
  }, [logs])

  const hasTimelineData = timeline.some((d) => d.requests > 0)

  // Prompt vs completion token split
  const tokenSplit = React.useMemo(() => {
    if (!stats || stats.total_tokens === 0) return []
    return [
      { name: 'توکن ورودی', value: stats.total_prompt_tokens },
      { name: 'توکن خروجی', value: stats.total_completion_tokens },
    ]
  }, [stats])
  const TOKEN_COLORS = ['var(--chart-1)', 'var(--chart-2)']

  // Latency of the most recent requests
  const latencyData = React.useMemo(
    () =>
      logs
        .slice(0, 20)
        .reverse()
        .map((l, i) => ({
          name: `#${i + 1}`,
          latency: l.duration_ms || 0,
          status: l.status,
        })),
    [logs]
  )

  // Request distribution by endpoint
  const endpointData = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const log of logs) {
      const ep = (log.endpoint || 'unknown').replace(/\s*\(.*\)/, '')
      counts.set(ep, (counts.get(ep) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [logs])
  const ENDPOINT_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

  const successCount = logs.filter((l) => l.status === 'success').length
  const successRate = logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 100

  const axisStyle = { fontSize: 10, fill: 'var(--muted-foreground)' }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl w-full mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <LuActivity className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground">داشبورد تحلیلی مدیریت</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              پایش زنده مصرف توکن، تاخیر پاسخ‌گویی، هزینه تخمینی و سلامت سیستم
            </p>
          </div>

          <button
            onClick={() => { setLoading(true); fetchAll() }}
            className="h-8 px-3 rounded-full border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition flex items-center gap-1.5"
          >
            <LuRefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
            <span>به‌روزرسانی</span>
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<LuZap className="w-4 h-4" />}
            label="کل درخواست‌های AI"
            value={fmt(stats?.total_requests ?? 0)}
            sub={`${fmt(logs.length)} مورد در بازه اخیر`}
            accent="text-primary"
          />
          <KpiCard
            icon={<LuCoins className="w-4 h-4" />}
            label="مجموع توکن مصرفی"
            value={fmt(stats?.total_tokens ?? 0)}
            sub={`میانگین ${(stats?.avg_duration_ms ?? 0).toFixed(0)}ms پاسخ‌گویی`}
            accent="text-mint"
          />
          <KpiCard
            icon={<LuTrendingUp className="w-4 h-4" />}
            label="هزینه تخمینی"
            value={`${fmt(Math.round(stats?.estimated_cost_toman ?? 0))} تومان`}
            sub={`$${(stats?.estimated_cost_usd ?? 0).toFixed(3)} دلار`}
            accent="text-gold"
          />
          <KpiCard
            icon={<LuUsers className="w-4 h-4" />}
            label="کاربران فعال"
            value={fmt(stats?.total_users ?? 0)}
            sub={`نرخ موفقیت ${successRate.toLocaleString('fa-IR')}٪`}
            accent="text-primary"
          />
        </div>

        {/* Charts Row 1: Timeline + Token Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ChartCard title="روند درخواست‌ها در ۲۴ ساعت گذشته" subtitle="تعداد فراخوانی‌های هوش مصنوعی به تفکیک ساعت">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" tick={axisStyle} tickLine={false} axisLine={false} interval={3} />
                  <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)' }} />
                  <Area
                    type="monotone"
                    dataKey="requests"
                    name="درخواست"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#gradRequests)"
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--chart-1)', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="ترکیب مصرف توکن" subtitle="ورودی مدل در برابر خروجی تولیدشده" isEmpty={tokenSplit.length === 0}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip content={<ChartTooltip />} />
                <Pie
                  data={tokenSplit}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="85%"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {tokenSplit.map((_, i) => (
                    <Cell key={i} fill={TOKEN_COLORS[i % TOKEN_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 -mt-2 pb-1" dir="rtl">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--chart-1)' }} />
                ورودی ({fmt(tokenSplit[0]?.value ?? 0)})
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--chart-2)' }} />
                خروجی ({fmt(tokenSplit[1]?.value ?? 0)})
              </span>
            </div>
          </ChartCard>
        </div>

        {/* Charts Row 2: Latency + Endpoints */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="تاخیر پاسخ‌گویی درخواست‌های اخیر" subtitle="مدت زمان پردازش هر فراخوانی (میلی‌ثانیه)" isEmpty={latencyData.length === 0}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={latencyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
                <Bar dataKey="latency" name="تاخیر" radius={[6, 6, 0, 0]} maxBarSize={22}>
                  {latencyData.map((d, i) => (
                    <Cell key={i} fill={d.status === 'success' ? 'var(--chart-1)' : 'var(--chart-5)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="توزیع درخواست‌ها بر اساس سرویس" subtitle="پرکاربردترین نقاط انتهایی API" isEmpty={endpointData.length === 0}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={endpointData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ ...axisStyle, fontSize: 9, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
                <Bar dataKey="value" name="درخواست" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {endpointData.map((_, i) => (
                    <Cell key={i} fill={ENDPOINT_COLORS[i % ENDPOINT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Cache & Index Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard
            icon={<LuDatabase className="w-4 h-4" />}
            label="بخش‌های برداری داکیومنت"
            value={fmt(cacheStats?.total_chunks ?? 0)}
            sub="ایندکس فعال در حافظه برداری"
            accent="text-primary"
          />
          <KpiCard
            icon={<LuZap className="w-4 h-4" />}
            label="نرخ اصابت کش"
            value={cacheStats?.cache_hit_rate || '۰٪'}
            sub={`${fmt(cacheStats?.cache_hits ?? 0)} موفق / ${fmt(cacheStats?.cache_misses ?? 0)} ناموفق`}
            accent="text-gold"
          />
          <KpiCard
            icon={<LuClock className="w-4 h-4" />}
            label="میانگین تاخیر سراسری"
            value={`${fmt(Math.round(stats?.avg_duration_ms ?? 0))}ms`}
            sub="زمان پاسخ مدل زبانی"
            accent="text-mint"
          />
        </div>

        {/* Manual Webhook Sync Trigger */}
        <div className="bg-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border elevation-1">
          <div>
            <h4 className="text-xs font-bold text-foreground mb-1">همگام‌سازی و بازایندکس اسناد</h4>
            <p className="text-[11px] text-muted-foreground">
              بررسی تغییرات فایل‌های مستندات و بردارسازی اسناد جدید در پایگاه داده وکتور
            </p>
          </div>

          <button
            onClick={triggerSync}
            disabled={isSyncing}
            className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-2 whitespace-nowrap"
          >
            {isSyncing ? <LuLoader className="w-3.5 h-3.5 animate-spin" /> : <LuRefreshCw className="w-3.5 h-3.5" />}
            <span>{isSyncing ? 'در حال همگام‌سازی...' : 'شروع همگام‌سازی دستی'}</span>
          </button>
        </div>

        {syncReport && (
          <div className="bg-mint/10 p-4 rounded-xl border border-mint/30 text-xs text-mint font-mono flex items-start gap-2">
            <LuCircleCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="min-w-0 break-all" dir="ltr">
              {typeof syncReport === 'object' ? JSON.stringify(syncReport) : syncReport}
            </span>
          </div>
        )}

        {/* Security Checklist */}
        <div className="bg-card p-5 space-y-4 rounded-2xl border border-border elevation-1">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <LuShieldCheck className="w-4 h-4 text-mint" />
            <span>مکانیزم‌های امنیتی و بهینه‌سازی اعمال‌شده</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              ['محدودکننده نرخ درخواست (Rate Limiting)', 'الگوریتم Token-Bucket بر پایه IP با ظرفیت ۶۰ درخواست در دقیقه'],
              ['ضد تزریق پرامپت (Prompt Injection Guard)', 'فیلترینگ و پاکسازی الگوهای مشکوک و حملات مهندسی معکوس سیستم'],
              ['همگام‌سازی تفاضلی اسناد (Incremental Sync)', 'بردارسازی مجدد فقط برای فایل‌های تغییریافته گیت‌هاب بر پایه هش SHA-256'],
              ['احراز هویت وب‌هوک با HMAC-SHA256', 'اعتبارسنجی امن امضای هدر X-Hub-Signature-256 گیت‌هاب'],
            ].map(([title, desc]) => (
              <div key={title} className="bg-muted/30 p-3 rounded-xl border border-border flex items-start gap-2.5">
                <LuCircleCheck className="w-4 h-4 text-mint flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block mb-0.5">{title}</strong>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
