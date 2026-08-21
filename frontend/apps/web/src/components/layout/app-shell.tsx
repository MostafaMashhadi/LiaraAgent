import React from 'react'
import {
  LuMenu,
  LuMessageSquare,
  LuSettings,
  LuSettings2,
  LuBug,
  LuBookOpen,
  LuShield,
} from 'react-icons/lu'
import { Sidebar } from './sidebar'
import { ThemeToggle } from './theme-toggle'
import { HeaderSearch } from './header-search'
import { UserMenu } from './user-menu'
import { cn } from '@/lib/utils'
import type { DocResult } from '@/types'

interface AppShellProps {
  children: React.ReactNode
  activeTab: string
  setActiveTab: (tab: string) => void
  currentUser: { id: string; email: string; name: string; role: string } | null
  onOpenAuth: () => void
  onLogout: () => void
  onOpenSettings: () => void
  isWsConnected: boolean
  onSelectDoc: (doc: DocResult) => void
  onDeleteSession: (sessId: string) => void
  onNewSession: () => void
  onSelectSession: (sessId: string) => void
  sessions: { id: string; title: string; messages: unknown[] }[]
  activeSessionId: string
}

export function AppShell({
  children,
  activeTab,
  setActiveTab,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenSettings,
  isWsConnected,
  onSelectDoc,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(() => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        return false
      }
      return localStorage.getItem('liara_sidebar_open') !== 'false'
    } catch {
      return true
    }
  })

  const toggleSidebar = React.useCallback(() => {
    setSidebarOpen((prev) => {
      try {
        localStorage.setItem('liara_sidebar_open', String(!prev))
      } catch {
        // ignore storage errors
      }
      return !prev
    })
  }, [])

  const bottomNavItems = [
    { id: 'chat', label: 'گفتگو', icon: LuMessageSquare },
    { id: 'config', label: 'کانفیگ', icon: LuSettings2 },
    { id: 'logs', label: 'عیب‌یاب', icon: LuBug },
    { id: 'docs', label: 'مستندات', icon: LuBookOpen },
    ...(currentUser?.role === 'admin' ? [{ id: 'admin', label: 'مدیریت', icon: LuShield }] : []),
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        open={sidebarOpen}
        onToggle={toggleSidebar}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
        onNewSession={onNewSession}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-14 shrink-0 sticky top-0 z-30 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 border-b border-border bg-background/90 backdrop-blur-xl">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile Hamburger Drawer Toggle */}
            <button
              onClick={toggleSidebar}
              aria-label="منوی دستیار"
              className="lg:hidden h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <LuMenu className="w-5 h-5" />
            </button>

            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-xs sm:text-sm text-foreground truncate hidden sm:inline">
              دستیار هوشمند لیارا
            </span>
          </div>

          {/* Search Bar (Responsive: Full on Desktop, Expandable on Mobile) */}
          <HeaderSearch onSelectDoc={onSelectDoc} />

          {/* Top Left (RTL end) Action Icons & User Info */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Settings button */}
            <button
              onClick={onOpenSettings}
              aria-label="تنظیمات دستیار"
              title="تنظیمات دستیار"
              className="h-8 w-8 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <LuSettings className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Profile Menu */}
            <UserMenu
              currentUser={currentUser}
              onOpenAuth={onOpenAuth}
              onLogout={onLogout}
              onOpenSettings={onOpenSettings}
              onNavigateTab={setActiveTab}
            />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {children}
        </main>

        {/* Mobile / Tablet Bottom Navigation Bar */}
        <nav className="lg:hidden shrink-0 border-t border-border bg-card/95 backdrop-blur-md px-1 py-1 flex items-center justify-around z-30 elevation-3 safe-bottom">
          {bottomNavItems.map((item) => {
            const isActive = activeTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all relative flex-1',
                  isActive
                    ? 'text-primary font-bold bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                <Icon className={cn('w-4 h-4 transition-transform', isActive && 'scale-110 text-primary')} />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

