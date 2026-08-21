import React from 'react'
import { LuLogOut } from 'react-icons/lu'
import { Sidebar } from './sidebar'
import { ThemeToggle } from './theme-toggle'
import { HeaderSearch } from './header-search'
import type { DocResult } from '@/types'

interface AppShellProps {
  children: React.ReactNode
  activeTab: string
  setActiveTab: (tab: string) => void
  currentUser: { id: string; email: string; name: string; role: string } | null
  onOpenAuth: () => void
  onLogout: () => void
  isWsConnected: boolean
  onSelectDoc: (doc: DocResult) => void
  onDeleteSession: (sessId: string) => void
  onNewSession: () => void
  onSelectSession: (sessId: string) => void
  sessions: { id: string; title: string; messages: unknown[] }[]
  activeSessionId: string
}

export function AppShell({ children, activeTab, setActiveTab, currentUser, onOpenAuth, onLogout, isWsConnected, onSelectDoc, sessions, activeSessionId, onSelectSession, onDeleteSession, onNewSession }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(() => {
    try {
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
        onOpenAuth={onOpenAuth}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 sticky top-0 z-30 flex items-center justify-between gap-3 px-4 md:px-6 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex items-center min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>

          <HeaderSearch onSelectDoc={onSelectDoc} />

          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="hidden lg:flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-border bg-muted/40 text-xs"
              title={isWsConnected ? 'اتصال برقرار است' : 'اتصال برقرار نیست'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-mint' : 'bg-muted-foreground/50'}`}
                aria-hidden="true"
              />
              <span className="text-muted-foreground font-medium">
                {isWsConnected ? 'متصل' : 'غیرفعال'}
              </span>
            </div>

            <ThemeToggle />

            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
                  {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <button
                  onClick={onLogout}
                  aria-label="خروج از حساب"
                  title="خروج از حساب"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LuLogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="h-8 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                ورود
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
