import React from 'react';
import { LuMessageSquare, LuSettings2, LuBug, LuBookOpen, LuPlus, LuTrash2, LuShield, LuCircleHelp, LuExternalLink } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const tools = [
  { id: 'chat', label: 'دستیار گفتگو', icon: MessageSquare },
  { id: 'config', label: 'سازنده کانفیگ', icon: Settings2 },
  { id: 'logs', label: 'عیب‌یاب لاگ', icon: Bug },
  { id: 'docs', label: 'بانک مستندات', icon: BookOpen },
];

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sessions: { id: string; title: string; summary?: string }[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession?: (id: string) => void;
  currentUser?: { name?: string; email?: string; role?: string };
}

export default function Sidebar({ activeTab, setActiveTab, sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, currentUser }: SidebarProps) {
  return (
    <aside className="h-screen w-[280px] shrink-0 sticky top-0 flex flex-col border-l border-border bg-card elevation-1 overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Logo & Brand */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-primary flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
              <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">
                لیارا <span className="text-primary">دستیار هوشمند</span>
              </h1>
              <p className="text-[10px] text-muted-foreground">Platform Helper Agent</p>
            </div>
          </div>

          {/* New Chat */}
          <Button
            onClick={onNewSession}
            variant="teal"
            size="sm"
            className="w-full shadow-teal-glow"
          >
            <LuPlus className="h-4 w-4" />
            <span>گفتگوی جدید</span>
          </Button>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {/* Primary Tools */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-2">
              ابزارهای دستیار
            </p>
            <nav className="space-y-1">
              {tools.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      'sidebar-nav-item w-full',
                      isActive ? 'sidebar-nav-item active' : 'text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={cn(
                    'sidebar-nav-item w-full text-mint',
                    activeTab === 'admin' ? 'sidebar-nav-item active bg-mint text-mint-foreground' : 'hover:bg-mint/10'
                  )}
                >
                  <LuShield className="h-4 w-4 shrink-0" />
                  <span className="truncate">پنل مدیریت</span>
                </button>
              )}
            </nav>
          </div>

          {/* Recent Conversations */}
          {sessions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-2">
                تاریخچه گفتگوها
              </p>
              <div className="space-y-1">
                {sessions.map((sess) => {
                  const isSelected = activeSessionId === sess.id;
                  return (
                    <div
                      key={sess.id}
                      onClick={() => {
                        onSelectSession(sess.id);
                        setActiveTab('chat');
                      }}
                      className={cn(
                        'group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all duration-200',
                        isSelected
                          ? 'bg-muted text-foreground elevation-1'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        <LuMessageSquare className="h-3.5 w-3.5 shrink-0" />
                        <div className="truncate text-right min-w-0">
                          <p className="truncate font-medium">{sess.title || 'گفتگوی بدون عنوان'}</p>
                          {sess.summary && (
                            <p className="text-[10px] text-muted-foreground truncate">{sess.summary}</p>
                          )}
                        </div>
                      </div>
                      {onDeleteSession && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(sess.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition shrink-0"
                        >
                          <LuTrash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          {currentUser ? (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/50">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {currentUser.name || currentUser.email}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {currentUser.role === 'admin' ? 'مدیر سیستم' : 'کاربر توسعه‌دهنده'}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground text-center">
              مهمان · برای استفاده کامل وارد شوید
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

