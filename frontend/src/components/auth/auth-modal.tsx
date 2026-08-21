import React, { useState } from 'react';
import { LuUser, LuX, LuLogIn, LuUserPlus } from 'react-icons/lu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (token: string, user: { name?: string; email?: string }) => void;
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { email, password, name };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در احراز هویت');
      }
      onSuccess(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته');
    } finally {
      setIsLoading(false);
    }
  };

  const fillPreset = (em, pass) => {
    setEmail(em);
    setPassword(pass);
    setIsLogin(true);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md elevation-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <LuUser className="w-4 h-4" />
            </div>
            {isLogin ? 'ورود به حساب کاربری' : 'ثبت‌نام کاربر جدید'}
          </DialogTitle>
          <DialogDescription>
            {isLogin ? 'برای دسترسی به تمام قابلیت‌ها وارد شوید' : 'حساب کاربری جدید ایجاد کنید'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">نام و نام خانوادگی</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: علی رضایی"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">ایمیل</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              className="text-left"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">کلمه عبور</label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="text-left"
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full" variant="teal">
            {isLoading ? 'در حال پردازش...' : isLogin ? 'ورود به سامانه' : 'ایجاد حساب کاربری'}
          </Button>
        </form>

        <div className="flex items-center gap-4 pt-4 border-t border-border">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={cn(
              'flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors',
              isLogin ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            ورود
          </button>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={cn(
              'flex-1 text-center text-sm font-medium py-2 rounded-xl transition-colors',
              !isLogin ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            ثبت‌نام
          </button>
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-xs font-medium text-muted-foreground text-center">حساب‌های پیش‌فرض تست:</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fillPreset('admin@liara.ir', 'Admin@Liara2026!')}
              className="flex-1 text-xs"
            >
              Admin (مدیر)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fillPreset('user@liara.ir', 'User@Liara2026!')}
              className="flex-1 text-xs"
            >
              User (عادی)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

