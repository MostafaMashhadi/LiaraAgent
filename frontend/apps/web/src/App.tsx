import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { AuthModal } from '@/components/auth/auth-modal'
import { ChatView } from '@/components/chat/chat-view'
import { ConfigStudio } from '@/components/config/config-studio'
import { LogDebugger } from '@/components/logs/log-debugger'
import { DocsExplorer } from '@/components/docs/docs-explorer'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { StatsDashboard } from '@/components/stats/stats-dashboard'
import { LiaraUser, ChatMessage, Session, StreamMessage, DocResult } from '@/types'

export function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [currentUser, setCurrentUser] = useState<LiaraUser | null>(() => {
    try {
      const saved = localStorage.getItem('liara_auth_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('liara_auth_token') || '')
  const [showAuthModal, setShowAuthModal] = useState(false)

  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const saved = localStorage.getItem('liara_sessions')
      return saved ? JSON.parse(saved) : [{ id: 'sess_default', title: 'گفتگوی جاری', summary: '', messages: [] }]
    } catch {
      return [{ id: 'sess_default', title: 'گفتگوی جاری', summary: '', messages: [] }]
    }
  })
  const [activeSessionId, setActiveSessionId] = useState('sess_default')
  const [streamingBuffer, setStreamingBuffer] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isWsConnected, setIsWsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem('liara_sessions', JSON.stringify(sessions))
    } catch {
      // ignore storage errors
    }
  }, [sessions])

  const fetchDBSessions = useCallback(async () => {
    try {
      const headers: Record<string, string> = {}
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`
      const res = await fetch('/api/chat/sessions', { headers })
      if (res.ok) {
        const data = await res.json()
        if (data.sessions && data.sessions.length > 0) {
          setSessions((prev) => {
            const merged = data.sessions.map((dbSess: { id: string; title: string; summary?: string }) => {
              const existing = prev.find((p) => p.id === dbSess.id)
              return {
                id: dbSess.id,
                title: dbSess.title,
                summary: dbSess.summary,
                messages: existing ? existing.messages : [],
              }
            })
            return merged
          })
        }
      }
    } catch {
      // ignore fetch errors
    }
  }, [authToken])

  const fetchSessionMessages = useCallback(async (sessId: string) => {
    try {
      const headers: Record<string, string> = {}
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`
      const res = await fetch(`/api/chat/messages?session_id=${sessId}`, { headers })
      if (res.ok) {
        const data = await res.json()
        if (data.messages) {
          const parsed: ChatMessage[] = data.messages.map((m: { role: string; content: string; sources?: unknown; suggested_next?: string[]; duration_ms?: number }) => ({
            role: m.role,
            content: m.content,
            sources: m.sources,
            suggested_next: m.suggested_next,
            duration_ms: m.duration_ms,
          }))
          setSessions((prev) =>
            prev.map((s) => (s.id === sessId ? { ...s, messages: parsed } : s))
          )
        }
      }
    } catch {
      // ignore fetch errors
    }
  }, [authToken])

  useEffect(() => {
    fetchDBSessions()
  }, [fetchDBSessions])

  useEffect(() => {
    if (activeSessionId) {
      const target = sessions.find((s) => s.id === activeSessionId)
      if (!target || !target.messages || target.messages.length === 0) {
        fetchSessionMessages(activeSessionId)
      }
    }
  }, [activeSessionId, sessions, fetchSessionMessages])

  const handleLoginSuccess = (token: string, user: LiaraUser) => {
    setAuthToken(token)
    setCurrentUser(user)
    localStorage.setItem('liara_auth_token', token)
    localStorage.setItem('liara_auth_user', JSON.stringify(user))
    setShowAuthModal(false)
  }

  const handleLogout = useCallback(() => {
    setAuthToken('')
    setCurrentUser(null)
    localStorage.removeItem('liara_auth_token')
    localStorage.removeItem('liara_auth_user')
    if (activeTab === 'admin') setActiveTab('chat')
  }, [activeTab])

  useEffect(() => {
    if (!authToken) return
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.user) {
          setCurrentUser(data.user)
          localStorage.setItem('liara_auth_user', JSON.stringify(data.user))
        } else {
          handleLogout()
        }
      })
      .catch(() => {})
  }, [authToken, handleLogout])

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0]
  const messages = currentSession ? currentSession.messages : []

  const updateSessionMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions((prevSessions) =>
      prevSessions.map((s) => {
        if (s.id === activeSessionId) {
          const newMessages = typeof updater === 'function' ? updater(s.messages) : updater
          let newTitle = s.title
          if (s.title === 'گفتگوی جاری' || s.title === 'گفتگوی جدید') {
            const firstUser = newMessages.find((m) => m.role === 'user')
            if (firstUser) {
              newTitle = firstUser.content.slice(0, 30) + (firstUser.content.length > 30 ? '...' : '')
            }
          }
          return { ...s, messages: newMessages, title: newTitle }
        }
        return s
      })
    )
  }, [activeSessionId])

  const handleIncomingStream = useCallback((data: StreamMessage) => {
    if (data.type === 'token') {
      setIsStreaming(true)
      setStreamingBuffer((prev) => prev + (data.token || ''))
    } else if (data.type === 'done') {
      setIsStreaming(false)
      setStreamingBuffer('')
      updateSessionMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message || '',
          sources: data.sources,
          suggested_next: data.suggested_next,
          duration_ms: data.duration_ms,
        },
      ])
      fetchDBSessions()
    } else if (data.type === 'error') {
      setIsStreaming(false)
      setStreamingBuffer('')
      updateSessionMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**خطا:** ${data.error || 'خطای پردازش درخواست'}`,
        },
      ])
    }
  }, [updateSessionMessages, fetchDBSessions])

  useEffect(() => {
    let ws: WebSocket | null = null
    const connectWS = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/ws/chat${authToken ? '?token=' + authToken : ''}`
        ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => setIsWsConnected(true)
        ws.onmessage = (event) => {
          try {
            const data: StreamMessage = JSON.parse(event.data)
            handleIncomingStream(data)
          } catch {
            // ignore parse errors
          }
        }
        ws.onclose = () => {
          setIsWsConnected(false)
          setTimeout(connectWS, 3000)
        }
        ws.onerror = () => ws?.close()
      } catch {
        setIsWsConnected(false)
      }
    }

    connectWS()
    return () => {
      if (ws) ws.close()
    }
  }, [activeSessionId, authToken, handleIncomingStream])

  const handleSendMessage = async (text: string) => {
    if (!text || isStreaming) return

    updateSessionMessages((prev) => [...prev, { role: 'user', content: text }])
    setStreamingBuffer('')
    setIsStreaming(true)

    if (isWsConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          message: text,
          session_id: activeSessionId,
        })
      )
    } else {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        }
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`

        const res = await fetch('/api/chat?stream=true', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: text,
            session_id: activeSessionId,
          }),
        })

        if (!res.ok) {
          const raw = await res.text()
          throw new Error(raw || 'خطای ارتباط با سرور')
        }

        const reader = res.body?.getReader()
        const decoder = new TextDecoder('utf-8')
        let partial = ''

        if (!reader) throw new Error('No reader available')

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          partial += decoder.decode(value, { stream: true })
          const lines = partial.split('\n')
          partial = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue
            const jsonStr = trimmed.replace(/^data:\s*/, '')
            try {
              const data: StreamMessage = JSON.parse(jsonStr)
              handleIncomingStream(data)
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        setIsStreaming(false)
        setStreamingBuffer('')
        updateSessionMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**خطا در ارتباط با سرور:**\n\n${err instanceof Error ? err.message : 'خطای ناشناخته'}`,
          },
        ])
      }
    }
  }

  const handleNewSession = useCallback(() => {
    const newId = 'sess_' + Math.random().toString(36).substring(2, 9)
    const newSession: Session = { id: newId, title: 'گفتگوی جدید', summary: '', messages: [] }
    setSessions((prev) => [newSession, ...prev])
    setActiveSessionId(newId)
    setStreamingBuffer('')
    setIsStreaming(false)
    setActiveTab('chat')
  }, [])

  const handleDeleteSession = useCallback(async (sessId: string) => {
    try {
      const headers: Record<string, string> = {}
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`
      await fetch(`/api/chat/sessions?session_id=${sessId}`, {
        method: 'DELETE',
        headers,
      })
    } catch {
      // ignore delete errors
    }

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessId)
      if (filtered.length === 0) {
        const fresh: Session = { id: 'sess_' + Math.random().toString(36).substring(2, 9), title: 'گفتگوی جدید', summary: '', messages: [] }
        setActiveSessionId(fresh.id)
        return [fresh]
      }
      if (activeSessionId === sessId) {
        setActiveSessionId(filtered[0].id)
      }
      return filtered
    })
  }, [authToken, activeSessionId])

  const handleClearCurrentSession = useCallback(() => {
    updateSessionMessages([])
    setStreamingBuffer('')
    setIsStreaming(false)
  }, [updateSessionMessages])

  const [focusDoc, setFocusDoc] = useState<DocResult | null>(null)

  const handleSelectDoc = useCallback((doc: DocResult) => {
    setFocusDoc(doc)
    setActiveTab('docs')
  }, [])

  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      currentUser={currentUser}
      onOpenAuth={() => setShowAuthModal(true)}
      onLogout={handleLogout}
      isWsConnected={isWsConnected}
      onSelectDoc={handleSelectDoc}
      onDeleteSession={handleDeleteSession}
      onNewSession={handleNewSession}
      onSelectSession={setActiveSessionId}
      sessions={sessions}
      activeSessionId={activeSessionId}
    >
      {activeTab === 'chat' && (
        <ChatView
          messages={messages}
          onSendMessage={handleSendMessage}
          streamingBuffer={streamingBuffer}
          isStreaming={isStreaming}
          onClearSession={handleClearCurrentSession}
        />
      )}

      {activeTab === 'config' && <ConfigStudio />}

      {activeTab === 'logs' && <LogDebugger />}

      {activeTab === 'docs' && <DocsExplorer focusDoc={focusDoc} />}

      {activeTab === 'admin' && currentUser?.role === 'admin' && <AdminDashboard authToken={authToken} />}

      {activeTab === 'stats' && <StatsDashboard />}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </AppShell>
  )
}
