import React from 'react';
import { LuSearch, LuCirclePlus, LuBookOpen, LuExternalLink, LuUser, LuLogOut, LuTerminal, LuWifi, LuWifiOff } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  isWsConnected: boolean;
  onNewChat: () => void;
  currentUser?: { name?: string; email?: string };
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onSearch?: (query: string) => void;
}

export default function Header({ isWsConnected, onNewChat, currentUser, onOpenAuth, onLogout, onSearch }: HeaderProps) {
  return (
    <header className="h-16 shrink-0 sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 border-b border-border bg-card/80 backdrop-blur-xl elevation-1">
      {/* Left: Brand (in RTL this appears on the right side visually) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-primary flex items-center justify-center text-white shadow-md shadow-teal-500/20">
            <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-foreground">دستیار هوشمند لیارا</h1>
            <p className="text-[10px] text-muted-foreground">Platform Helper Agent</p>
          </div>
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-xl mx-4 hidden md:block">
        <div className="relative group">
          <LuSearch className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="جستجو در مستندات، لاگ‌ها و تنظیمات..."
            onChange={(e) => onSearch?.(e.target.value)}
            className="w-full h-10 pr-10 pl-4 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border bg-muted/50 text-xs">
          {isWsConnected ? (
            <LuWifi className="h-3.5 w-3.5 text-mint" />
          ) : (
            <LuWifiOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-muted-foreground font-medium">
            {isWsConnected ? 'متصل' : 'غیرفعال'}
          </span>
        </div>

        {/* New Chat */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewChat}
          className="hidden sm:flex"
        >
          <LuCirclePlus className="h-4 w-4" />
          <span>گفتگوی جدید</span>
        </Button>

        {/* Docs Link */}
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="hidden md:flex"
        >
          <a href="https://docs.liara.ir" target="_blank" rel="noreferrer">
            <LuBookOpen className="h-4 w-4" />
          </a>
        </Button>

        {/* Console Link */}
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="hidden md:flex"
        >
          <a href="https://console.liara.ir" target="_blank" rel="noreferrer">
            <LuTerminal className="h-4 w-4" />
          </a>
        </Button>

        {/* User Profile or Login */}
        {currentUser ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {currentUser.name ? currentUser.name.charAt(0) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="hidden lg:block">
              <p className="text-xs font-medium text-foreground truncate max-w-[120px]">
                {currentUser.name || currentUser.email}
              </p>
            </div>
            {onLogout && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
                className="text-muted-foreground hover:text-destructive"
              >
                <LuLogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <Button variant="default" size="sm" onClick={onOpenAuth}>
            <LuUser className="h-4 w-4" />
            <span className="hidden sm:inline">ورود</span>
          </Button>
        )}
      </div>
    </header>
  );
}

