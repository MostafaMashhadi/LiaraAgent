import React from 'react';
import { User, LogOut, Terminal, BookOpen, ExternalLink, PlusCircle } from 'lucide-react';

export default function Header({ isWsConnected, onNewChat, currentUser, onOpenAuth, onLogout }) {
  return (
    <header className="bg-[#222222]/95 backdrop-blur-md border-b border-[#ffffff15] px-5 py-3 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Left: Liara Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#0076ff] flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-sm">
          <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white tracking-tight">
              دستیار هوشمند ابری <span className="liara-gradient-text">لیارا</span>
            </h1>
            {currentUser && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                currentUser.role === 'admin' 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : 'bg-[#0076ff]/15 text-[#38bdf8] border-[#0076ff]/30'
              }`}>
                {currentUser.role === 'admin' ? 'مدیر سیستم (Admin)' : 'کاربر توسعه‌دهنده'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#a0acb7]">پاسخگویی فنی، عیب‌یابی استقرار و ابزارهای زیرساخت ابری</p>
        </div>
      </div>

      {/* Right: Actions & Links */}
      <div className="flex items-center gap-2.5">
        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 text-xs liara-btn-ghost px-3 py-1.5 rounded-lg font-medium"
        >
          <PlusCircle className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>گفتگوی جدید</span>
        </button>

        {/* Connection Status */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#181818] px-2.5 py-1.5 rounded-lg border border-[#ffffff15] text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[#a0acb7] font-medium text-[11px]">
            {isWsConnected ? 'متصل به سرور' : 'سرویس فعال'}
          </span>
        </div>

        {/* Liara Console Link */}
        <a
          href="https://console.liara.ir"
          target="_blank"
          rel="noreferrer"
          className="hidden md:flex items-center gap-1.5 text-xs liara-btn-ghost px-3 py-1.5 rounded-lg"
        >
          <Terminal className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>کنسول لیارا</span>
        </a>

        {/* Official Docs Link */}
        <a
          href="https://docs.liara.ir"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs liara-btn-primary px-3.5 py-1.5 rounded-lg font-medium shadow"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">مستندات</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>

        {/* User Profile / Login Button */}
        {currentUser ? (
          <div className="flex items-center gap-2 bg-[#181818] border border-[#ffffff15] px-2.5 py-1 rounded-xl">
            <div className="w-6 h-6 rounded-lg bg-[#0076ff]/20 text-[#38bdf8] flex items-center justify-center text-xs font-bold">
              {currentUser.name ? currentUser.name.charAt(0) : 'U'}
            </div>
            <span className="text-xs text-[#eeeeee] font-medium hidden md:inline">
              {currentUser.name || currentUser.email}
            </span>
            <button
              onClick={onLogout}
              className="text-[#a0acb7] hover:text-rose-400 p-1 transition"
              title="خروج از حساب"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 text-xs liara-btn-primary px-3.5 py-1.5 rounded-lg font-medium shadow"
          >
            <User className="w-3.5 h-3.5" />
            <span>ورود / ثبت‌نام</span>
          </button>
        )}
      </div>
    </header>
  );
}
