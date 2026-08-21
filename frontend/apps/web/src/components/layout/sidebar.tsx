import React from 'react'
import { LuMessageSquare, LuSettings2, LuBug, LuBookOpen, LuPlus, LuTrash2, LuShield, LuLogIn, LuLogOut, LuPanelRightClose, LuPanelRightOpen } from 'react-icons/lu'
import { cn } from '@/lib/utils'

const tools = [
  { id: 'chat', label: 'دستیار گفتگو', icon: LuMessageSquare },
  { id: 'config', label: 'سازنده کانفیگ', icon: LuSettings2 },
  { id: 'logs', label: 'عیب‌یاب لاگ', icon: LuBug },
  { id: 'docs', label: 'بانک مستندات', icon: LuBookOpen },
]

interface SidebarProps {
  open: boolean
  onToggle: () => void
  activeTab: string
  setActiveTab: (tab: string) => void
  sessions: { id: string; title: string; messages: unknown[] }[]
  activeSessionId: string
  onSelectSession: (sessId: string) => void
  onNewSession: () => void
  onDeleteSession: (sessId: string) => void
  currentUser: { id: string; email: string; name: string; role: string } | null
  onLogout?: () => void
}

export function Sidebar({ open, onToggle, activeTab, setActiveTab, sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, currentUser, onLogout }: SidebarProps) {
  const navButton = (isActive: boolean) =>
    cn(
      'w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200',
      open ? 'px-3 py-2' : 'px-0 py-2 justify-center',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    )

  return (
    <aside
      className={cn(
        'h-screen shrink-0 sticky top-0 flex flex-col border-l border-border bg-card elevation-1 overflow-hidden transition-[width] duration-300 ease-in-out',
        open ? 'w-[280px]' : 'w-[68px]'
      )}
    >
      <div className="flex flex-col h-full min-w-[68px]">
        {/* Brand + single collapse toggle */}
        {open ? (
          <div className="flex items-center gap-3 p-4 pb-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-foreground leading-tight whitespace-nowrap">
                لیارا <span className="text-primary">دستیار هوشمند</span>
              </h1>
              <p className="text-[10px] text-muted-foreground">Platform Helper Agent</p>
            </div>
            <button
              onClick={onToggle}
              aria-label="بستن نوار کناری"
              aria-expanded={open}
              title="بستن نوار کناری"
              className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LuPanelRightClose className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-3 pb-2 mb-2">
            <button
              onClick={onToggle}
              aria-label="باز کردن نوار کناری"
              aria-expanded={open}
              title="باز کردن نوار کناری"
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LuPanelRightOpen className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
        )}

        {/* New chat */}
        <div className={cn('pb-2', open ? 'px-4' : 'px-3')}>
          <button
            onClick={onNewSession}
            title={open ? undefined : 'گفتگوی جدید'}
            aria-label="گفتگوی جدید"
            className={cn(
              'bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors active:translate-y-px',
              open ? 'w-full h-9 px-3 rounded-xl justify-center' : 'h-9 w-9 mx-auto rounded-xl justify-center'
            )}
          >
            <LuPlus className="h-4 w-4 shrink-0" />
            {open && <span>گفتگوی جدید</span>}
          </button>
        </div>

        <div className={cn('flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-6', open ? 'px-3' : 'px-2')}>
          {/* Tools */}
          <div>
            {open && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-2">
                ابزارهای دستیار
              </p>
            )}
            <nav className="space-y-1">
              {tools.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={open ? undefined : item.label}
                  aria-label={item.label}
                  className={navButton(activeTab === item.id)}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {open && <span className="truncate">{item.label}</span>}
                </button>
              ))}

              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  title={open ? undefined : 'پنل مدیریت'}
                  aria-label="پنل مدیریت"
                  className={navButton(activeTab === 'admin')}
                >
                  <LuShield className="h-4 w-4 shrink-0" />
                  {open && <span className="truncate">پنل مدیریت</span>}
                </button>
              )}
            </nav>
          </div>

          {/* Session history — only meaningful when expanded */}
          {open && sessions.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-2">
                تاریخچه گفتگوها
              </p>
              <div className="space-y-1">
                {sessions.map((sess) => {
                  const isSelected = activeSessionId === sess.id
                  return (
                    <div
                      key={sess.id}
                      onClick={() => {
                        onSelectSession(sess.id)
                        setActiveTab('chat')
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
                        </div>
                      </div>
                      {onDeleteSession && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteSession(sess.id)
                          }}
                          aria-label={`حذف ${sess.title || 'گفتگو'}`}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition shrink-0"
                        >
                          <LuTrash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer / user */}
        <div className={cn('border-t border-border', open ? 'p-3' : 'p-3 flex justify-center')}>
          {currentUser ? (
            open ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {currentUser.name || currentUser.email}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {currentUser.role === 'admin' ? 'مدیر سیستم' : 'کاربر توسعه‌دهنده'}
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  aria-label="خروج از حساب"
                  title="خروج از حساب"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <LuLogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogout}
                aria-label={`خروج (${currentUser.name || currentUser.email})`}
                title={`خروج — ${currentUser.name || currentUser.email}`}
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                {currentUser.name ? currentUser.name.charAt(0) : 'U'}
              </button>
            )
          ) : (
            <button
              onClick={() => setActiveTab('chat')}
              title="ورود به حساب"
              aria-label="ورود به حساب"
              className={cn(
                'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                open ? 'text-xs flex items-center gap-1.5 px-2 py-1.5 rounded-lg' : 'h-8 w-8 rounded-full flex items-center justify-center'
              )}
            >
              <LuLogIn className="h-4 w-4 shrink-0" />
              {open && <span>ورود به حساب</span>}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
