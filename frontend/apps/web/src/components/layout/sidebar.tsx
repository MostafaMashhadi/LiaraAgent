import React, { useEffect } from 'react'
import {
  LuMessageSquare,
  LuSettings2,
  LuBug,
  LuBookOpen,
  LuPlus,
  LuTrash2,
  LuShield,
  LuLogIn,
  LuLogOut,
  LuPanelRightClose,
  LuPanelRightOpen,
  LuX,
} from 'react-icons/lu'
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

export function Sidebar({
  open,
  onToggle,
  activeTab,
  setActiveTab,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  currentUser,
  onLogout,
}: SidebarProps) {
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    // Close drawer on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && open) {
      onToggle()
    }
  }

  const handleSessionClick = (sessId: string) => {
    onSelectSession(sessId)
    setActiveTab('chat')
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && open) {
      onToggle()
    }
  }

  const handleNewChatClick = () => {
    onNewSession()
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && open) {
      onToggle()
    }
  }

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (open && typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const renderSidebarContent = (isMobile: boolean) => {
    const isExpanded = isMobile || open

    return (
      <div className="flex flex-col h-full w-full select-none">
        {/* Brand Header */}
        <div
          className={cn(
            'flex items-center h-14 border-b border-border/50 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            isExpanded ? 'justify-between px-3.5' : 'justify-center px-0'
          )}
        >
          {/* Logo & Brand Title (smoothly hidden when collapsed) */}
          <div
            className={cn(
              'flex items-center gap-2.5 min-w-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden',
              isExpanded
                ? 'opacity-100 max-w-[200px]'
                : 'opacity-0 max-w-0 pointer-events-none'
            )}
          >
            <img src="/brand/liara-logo.svg" alt="لیارا" className="h-9 w-auto shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground leading-tight whitespace-nowrap">
                دستیار هوشمند <span className="text-primary">لیارا</span>
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono truncate">Platform AI Agent</p>
            </div>
          </div>

          {/* Toggle Button */}
          <button
            onClick={onToggle}
            aria-label={isMobile ? 'بستن منو' : isExpanded ? 'بستن نوار کناری' : 'باز کردن نوار کناری'}
            title={isMobile ? 'بستن منو' : isExpanded ? 'بستن نوار کناری' : 'باز کردن نوار کناری'}
            className={cn(
              'h-11 w-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0',
              !isExpanded && 'mx-auto'
            )}
          >
            {isMobile ? (
              <LuX className="w-5 h-5" />
            ) : isExpanded ? (
              <LuPanelRightClose className="w-5 h-5" />
            ) : (
              <LuPanelRightOpen className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* New Chat Button */}
        <div className={cn('pb-1 shrink-0 transition-all duration-300', isExpanded ? 'p-2.5' : 'p-2 flex justify-center')}>
          <button
            onClick={handleNewChatClick}
            title={!isExpanded ? 'گفتگوی جدید' : undefined}
            aria-label="گفتگوی جدید"
            className={cn(
              'h-9 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center hover:bg-primary/90 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-sm active:scale-[0.98] cursor-pointer',
              isExpanded ? 'w-full px-3 justify-center gap-2' : 'w-9 h-9 mx-auto px-0 justify-center'
            )}
          >
            <LuPlus className="h-4 w-4 shrink-0" />
            <span
              className={cn(
                'whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                isExpanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0 overflow-hidden'
              )}
            >
              گفتگوی جدید
            </span>
          </button>
        </div>

        {/* Scrollable Navigation & Sessions */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4">
          {/* Tools Section */}
          <div>
            <p
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-2.5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                isExpanded ? 'opacity-100 max-h-6' : 'opacity-0 max-h-0 overflow-hidden m-0 p-0'
              )}
            >
              ابزارهای دستیار
            </p>
            <nav className="space-y-1">
              {tools.map((item) => {
                const isActive = activeTab === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    title={!isExpanded ? item.label : undefined}
                    aria-label={item.label}
                    className={cn(
                      'h-9.5 rounded-xl text-xs font-medium flex items-center transition-all duration-200 cursor-pointer',
                      isExpanded ? 'w-full px-3 gap-2.5 justify-start' : 'w-9 h-9.5 mx-auto px-0 justify-center',
                      isActive
                        ? 'bg-primary/10 text-primary font-bold shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                    <span
                      className={cn(
                        'whitespace-nowrap truncate transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                        isExpanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0 overflow-hidden'
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                )
              })}

              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => handleTabClick('admin')}
                  title={!isExpanded ? 'پنل مدیریت' : undefined}
                  aria-label="پنل مدیریت"
                  className={cn(
                    'h-9.5 rounded-xl text-xs font-medium flex items-center transition-all duration-200 cursor-pointer',
                    isExpanded ? 'w-full px-3 gap-2.5 justify-start' : 'w-9 h-9.5 mx-auto px-0 justify-center',
                    activeTab === 'admin'
                      ? 'bg-primary/10 text-primary font-bold shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <LuShield className={cn('h-4 w-4 shrink-0', activeTab === 'admin' && 'text-primary')} />
                  <span
                    className={cn(
                      'whitespace-nowrap truncate transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                      isExpanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0 overflow-hidden'
                    )}
                  >
                    پنل مدیریت
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* Session History (Smoothly collapsed when sidebar is narrow) */}
          <div
            className={cn(
              'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
              isExpanded ? 'opacity-100 max-h-[800px]' : 'opacity-0 max-h-0 overflow-hidden pointer-events-none'
            )}
          >
            {sessions.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-2.5">
                  تاریخچه گفتگوها
                </p>
                <div className="space-y-1">
                  {sessions.map((sess) => {
                    const isSelected = activeSessionId === sess.id
                    return (
                      <div
                        key={sess.id}
                        onClick={() => handleSessionClick(sess.id)}
                        className={cn(
                          'group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150',
                          isSelected
                            ? 'bg-muted text-foreground font-semibold elevation-1'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2 overflow-hidden min-w-0">
                          <LuMessageSquare className={cn('h-3.5 w-3.5 shrink-0', isSelected && 'text-primary')} />
                          <p className="truncate text-right">{sess.title || 'گفتگوی بدون عنوان'}</p>
                        </div>
                        {onDeleteSession && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteSession(sess.id)
                            }}
                            aria-label={`حذف ${sess.title || 'گفتگو'}`}
                            title="حذف گفتگو"
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all shrink-0"
                          >
                            <LuTrash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer User Info */}
        <div className="p-2.5 border-t border-border/50 shrink-0">
          {currentUser ? (
            <div
              className={cn(
                'flex items-center rounded-xl p-1.5 transition-all duration-200',
                isExpanded ? 'gap-2 hover:bg-muted/50' : 'justify-center'
              )}
            >
              <div
                title={currentUser.name || currentUser.email}
                className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0 shadow-sm"
              >
                {currentUser.name ? currentUser.name.charAt(0) : 'U'}
              </div>

              <div
                className={cn(
                  'flex-1 min-w-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                  isExpanded ? 'opacity-100 max-w-[130px]' : 'opacity-0 max-w-0 overflow-hidden'
                )}
              >
                <p className="text-xs font-bold text-foreground truncate">
                  {currentUser.name || currentUser.email.split('@')[0]}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {currentUser.role === 'admin' ? 'مدیر سیستم' : 'توسعه‌دهنده'}
                </p>
              </div>

              {isExpanded && onLogout && (
                <button
                  onClick={onLogout}
                  aria-label="خروج از حساب"
                  title="خروج از حساب"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <LuLogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => handleTabClick('chat')}
              title={!isExpanded ? 'ورود به حساب' : undefined}
              aria-label="ورود به حساب"
              className={cn(
                'w-full h-8.5 rounded-xl text-xs font-medium flex items-center transition-colors text-muted-foreground hover:text-foreground hover:bg-muted',
                isExpanded ? 'px-2.5 gap-2 justify-start' : 'px-0 justify-center'
              )}
            >
              <LuLogIn className="h-4 w-4 shrink-0 text-primary" />
              <span
                className={cn(
                  'whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                  isExpanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0 overflow-hidden'
                )}
              >
                ورود به حساب
              </span>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer (Slide-out from Right in RTL) */}
      <aside
        className={cn(
          'mobile-sidebar fixed inset-y-0 right-0 z-50 w-[min(280px,calc(100vw-1rem))] bg-card border-l border-border elevation-4 lg:hidden transition-transform duration-[340ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          open ? 'translate-x-0 shadow-2xl animate-mobile-sidebar-in' : 'translate-x-full pointer-events-none'
        )}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Desktop Sticky Sidebar (Smooth Width Transition) */}
      <aside
        className={cn(
          'h-screen shrink-0 sticky top-0 hidden lg:flex flex-col border-l border-border bg-card elevation-1 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[width]',
          open ? 'w-[260px]' : 'w-[64px]'
        )}
      >
        {renderSidebarContent(false)}
      </aside>
    </>
  )
}
