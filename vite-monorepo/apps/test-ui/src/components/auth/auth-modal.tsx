import React, { useState } from 'react'
import { LuX, LuUser } from 'react-icons/lu'
import { cn } from '@/lib/utils'
import { LiaraUser } from '@/types'

interface AuthModalProps {
  onClose: () => void
  onSuccess: (token: string, user: LiaraUser) => void
}

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
    const body = isLogin ? { email, password } : { email, password, name }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'خطا در احراز هویت')
      }
      onSuccess(data.token, data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته')
    } finally {
      setIsLoading(false)
    }
  }

  const fillPreset = (em: string, pass: string) => {
    setEmail(em)
    setPassword(pass)
    setIsLogin(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md elevation-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <LuX className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <LuUser className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isLogin ? 'ورود به حساب کاربری' : 'ثبت‌نام کاربر جدید'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isLogin ? 'برای دسترسی به تمام قابلیت‌ها وارد شوید' : 'حساب کاربری جدید ایجاد کنید'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">نام و نام خانوادگی</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: علی رضایی"
                className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">ایمیل</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">کلمه عبور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'در حال پردازش...' : isLogin ? 'ورود به سامانه' : 'ایجاد حساب کاربری'}
          </button>
        </form>

        <div className="flex items-center gap-4 pt-4 mt-4 border-t border-border">
          <button
            onClick={() => { setIsLogin(true); setError('') }}
            className={cn(
              'flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors',
              isLogin ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            ورود
          </button>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => { setIsLogin(false); setError('') }}
            className={cn(
              'flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors',
              !isLogin ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            ثبت‌نام
          </button>
        </div>

        <div className="pt-3 mt-3 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground text-center">حساب‌های پیش‌فرض تست:</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fillPreset('admin@liara.ir', 'Admin@Liara2026!')}
              className="flex-1 h-8 rounded-xl border border-border text-xs hover:bg-muted transition-colors"
            >
              Admin (مدیر)
            </button>
            <button
              type="button"
              onClick={() => fillPreset('user@liara.ir', 'User@Liara2026!')}
              className="flex-1 h-8 rounded-xl border border-border text-xs hover:bg-muted transition-colors"
            >
              کاربر (عادی)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
