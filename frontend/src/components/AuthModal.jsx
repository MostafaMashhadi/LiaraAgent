import React, { useState } from 'react';
import { User, X, LogIn, UserPlus } from 'lucide-react';

export default function AuthModal({ onClose, onSuccess }) {
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
      setError(err.message);
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="liara-card max-w-md w-full p-6 space-y-5 bg-[#222222] border border-[#ffffff20]">
        <div className="flex items-center justify-between border-b border-[#ffffff15] pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#0076ff]" />
            <span>{isLogin ? 'ورود به حساب کاربری' : 'ثبت‌نام کاربر جدید'}</span>
          </h3>
          <button onClick={onClose} className="text-[#a0acb7] hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#ffffff15]">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1.5 ${
              isLogin ? 'border-[#0076ff] text-white' : 'border-transparent text-[#a0acb7]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>ورود (Login)</span>
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1.5 ${
              !isLogin ? 'border-[#0076ff] text-white' : 'border-transparent text-[#a0acb7]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>ثبت‌نام (Register)</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-xs text-[#a0acb7] block mb-1">نام و نام خانوادگی</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: علی رضایی"
                className="w-full bg-[#181818] border border-[#333333] focus:border-[#0076ff] text-xs rounded-xl p-3 text-white outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-[#a0acb7] block mb-1">ایمیل</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-[#181818] border border-[#333333] focus:border-[#0076ff] text-xs rounded-xl p-3 text-white outline-none font-mono text-left"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-xs text-[#a0acb7] block mb-1">کلمه عبور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#181818] border border-[#333333] focus:border-[#0076ff] text-xs rounded-xl p-3 text-white outline-none font-mono text-left"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full liara-btn-primary py-3 rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
          >
            {isLoading ? 'در حال پردازش...' : isLogin ? 'ورود به سامانه' : 'ایجاد حساب کاربری'}
          </button>
        </form>

        {/* Demo Fast Presets */}
        <div className="pt-3 border-t border-[#ffffff15] text-[11px] text-[#a0acb7] space-y-1.5">
          <p className="font-semibold text-[#eeeeee]">حساب‌های پیش‌فرض تست:</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fillPreset('admin@liara.ir', 'Admin@Liara2026!')}
              className="flex-1 p-2 bg-[#181818] hover:bg-[#282828] border border-[#ffffff15] rounded-lg text-emerald-400 font-mono text-[10px]"
            >
              Admin (مدیر سیستم)
            </button>
            <button
              type="button"
              onClick={() => fillPreset('user@liara.ir', 'User@Liara2026!')}
              className="flex-1 p-2 bg-[#181818] hover:bg-[#282828] border border-[#ffffff15] rounded-lg text-[#38bdf8] font-mono text-[10px]"
            >
              User (کاربر عادی)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
