import React from 'react';
import Sidebar from './sidebar';
import Header from './header';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sessions: { id: string; title: string; summary?: string }[];
  activeSessionId?: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession?: (id: string) => void;
  isWsConnected: boolean;
  currentUser?: { name?: string; email?: string; role?: string };
  onNewChat: () => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onSearch?: (query: string) => void;
}

export default function AppShell({
  children,
  activeTab,
  setActiveTab,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isWsConnected,
  currentUser,
  onNewChat,
  onOpenAuth,
  onLogout,
  onSearch,
}: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* RTL Sticky Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        onDeleteSession={onDeleteSession}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sticky Header */}
        <Header
          isWsConnected={isWsConnected}
          onNewChat={onNewChat}
          currentUser={currentUser}
          onOpenAuth={onOpenAuth}
          onLogout={onLogout}
          onSearch={onSearch}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
