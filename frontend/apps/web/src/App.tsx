import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { AuthModal } from '@/components/auth/auth-modal'
import { SettingsModal } from '@/components/settings-modal'
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
  const [showSettingsModal, setShowSettingsModal] = useState(false)

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
        if (data.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
          setSessions((prev) => {
            const dbMap = new Map<string, { id: string; title: string; summary?: string }>(
              data.sessions.map((s: { id: string; title: string; summary?: string }) => [s.id, s])
            )
            // Keep all local sessions and update titles/summaries if present in DB
            const updated = prev.map((local) => {
              const dbItem = dbMap.get(local.id)
              if (dbItem) {
                dbMap.delete(local.id)
                return {
                  ...local,
                  title:
                    local.title && local.title !== 'گفتگوی جاری' && local.title !== 'گفتگوی جدید'
                      ? local.title
                      : dbItem.title || local.title,
                  summary: dbItem.summary || local.summary,
                }
              }
              return local
            })
            // Append any remote sessions not already present locally
            for (const [, dbItem] of dbMap) {
              updated.push({
                id: dbItem.id,
                title: dbItem.title || 'گفتگو',
                summary: dbItem.summary || '',
                messages: [],
              })
            }
            return updated
          })
        }
      }
    } catch {
      // ignore fetch errors
    }
  }, [authToken])

  const fetchedSessionsRef = useRef<Set<string>>(new Set())

  const fetchSessionMessages = useCallback(async (sessId: string) => {
    if (!sessId || fetchedSessionsRef.current.has(sessId)) return
    fetchedSessionsRef.current.add(sessId)

    try {
      const headers: Record<string, string> = {}
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`
      const res = await fetch(`/api/chat/messages?session_id=${sessId}`, { headers })
      if (res.ok) {
        const data = await res.json()
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          const parsed: ChatMessage[] = data.messages.map(
            (m: {
              role: string
              content: string
              sources?: unknown
              suggested_next?: string[]
              duration_ms?: number
            }) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
              sources: m.sources as DocResult['sources'],
              suggested_next: m.suggested_next,
              duration_ms: m.duration_ms,
            })
          )
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id === sessId) {
                // If local session already has more recent messages, keep local
                if (s.messages.length >= parsed.length) return s
                return { ...s, messages: parsed }
              }
              return s
            })
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
  }, [activeSessionId, fetchSessionMessages, sessions])

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

  const updateSessionMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setSessions((prevSessions) => {
        let found = false
        const updated = prevSessions.map((s) => {
          if (s.id === activeSessionId) {
            found = true
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

        if (!found) {
          const newMessages = typeof updater === 'function' ? updater([]) : updater
          let newTitle = 'گفتگوی جاری'
          const firstUser = newMessages.find((m) => m.role === 'user')
          if (firstUser) {
            newTitle = firstUser.content.slice(0, 30) + (firstUser.content.length > 30 ? '...' : '')
          }
          return [{ id: activeSessionId, title: newTitle, summary: '', messages: newMessages }, ...prevSessions]
        }
        return updated
      })
    },
    [activeSessionId]
  )

  const streamingBufferRef = useRef('')
  const handleIncomingStreamRef = useRef<(data: StreamMessage) => void>(() => {})

  const handleIncomingStream = useCallback(
    (data: StreamMessage) => {
      if (data.type === 'token') {
        setIsStreaming(true)
        setStreamingBuffer((prev) => {
          const next = prev + (data.token || '')
          streamingBufferRef.current = next
          return next
        })
      } else if (data.type === 'done') {
        setIsStreaming(false)
        const finalContent = (data.message && data.message.trim()) ? data.message : streamingBufferRef.current
        setStreamingBuffer('')
        streamingBufferRef.current = ''
        updateSessionMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: finalContent || '',
            sources: data.sources,
            suggested_next: data.suggested_next,
            duration_ms: data.duration_ms,
          },
        ])
      } else if (data.type === 'error') {
        setIsStreaming(false)
        setStreamingBuffer('')
        streamingBufferRef.current = ''
        updateSessionMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**خطا:** ${data.error || 'خطای پردازش درخواست'}`,
          },
        ])
      }
    },
    [updateSessionMessages]
  )

  handleIncomingStreamRef.current = handleIncomingStream

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let isCleanedUp = false

    const connectWS = () => {
      if (isCleanedUp) return
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsUrl = `${protocol}//${window.location.host}/ws/chat${authToken ? '?token=' + authToken : ''}`
        ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (!isCleanedUp) setIsWsConnected(true)
        }
        ws.onmessage = (event) => {
          try {
            const data: StreamMessage = JSON.parse(event.data)
            handleIncomingStreamRef.current(data)
          } catch {
            // ignore parse errors
          }
        }
        ws.onclose = () => {
          if (!isCleanedUp) {
            setIsWsConnected(false)
            reconnectTimeout = setTimeout(connectWS, 3000)
          }
        }
        ws.onerror = () => ws?.close()
      } catch {
        if (!isCleanedUp) setIsWsConnected(false)
      }
    }

    connectWS()
    return () => {
      isCleanedUp = true
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (ws) ws.close()
    }
  }, [authToken])

  const handleSendMessage = async (text: string) => {
    if (!text || isStreaming) return

    updateSessionMessages((prev) => [...prev, { role: 'user', content: text }])
    setStreamingBuffer('')
    streamingBufferRef.current = ''
    setIsStreaming(true)

    // Check user preference for streaming mode (default: true)
    let isStreamPref = true
    try {
      isStreamPref = localStorage.getItem('liara_ai_stream') !== 'false'
    } catch {
      // Keep the default when localStorage is unavailable.
    }

    if (isStreamPref && isWsConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
          Accept: isStreamPref ? 'text/event-stream, application/json' : 'application/json',
        }
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`

        const res = await fetch(`/api/chat?stream=${isStreamPref ? 'true' : 'false'}`, {
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

        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json') || !isStreamPref) {
          const data = await res.json()
          handleIncomingStream({
            type: 'done',
            message: data.answer || data.message || '',
            sources: data.sources,
            suggested_next: data.suggested_next,
            duration_ms: data.duration_ms,
            session_id: activeSessionId,
          })
          return
        }

        const reader = res.body?.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        if (!reader) throw new Error('جریان داده پاسخ در دسترس نیست')

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          let eventEndIndex: number
          while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, eventEndIndex)
            buffer = buffer.slice(eventEndIndex + 2)

            const lines = rawEvent.split('\n')
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || !trimmed.startsWith('data:')) continue
              const dataStr = trimmed.slice(5).trim()
              if (!dataStr) continue
              try {
                const data: StreamMessage = JSON.parse(dataStr)
                handleIncomingStream(data)
              } catch (err) {
                console.warn('Failed to parse SSE chunk', err, dataStr)
              }
            }
          }
        }

        // Flush remaining buffer
        if (buffer.trim()) {
          const lines = buffer.split('\n')
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue
            const dataStr = trimmed.slice(5).trim()
            if (!dataStr) continue
            try {
              const data: StreamMessage = JSON.parse(dataStr)
              handleIncomingStream(data)
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        setIsStreaming(false)
        setStreamingBuffer('')
        streamingBufferRef.current = ''
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

  const handleClearAllSessions = useCallback(() => {
    const fresh: Session = {
      id: 'sess_' + Math.random().toString(36).substring(2, 9),
      title: 'گفتگوی جاری',
      summary: '',
      messages: [],
    }
    setSessions([fresh])
    setActiveSessionId(fresh.id)
    setStreamingBuffer('')
    setIsStreaming(false)
    try {
      localStorage.setItem('liara_sessions', JSON.stringify([fresh]))
    } catch {
      // ignore
    }
  }, [])

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
      onOpenSettings={() => setShowSettingsModal(true)}
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

      {showSettingsModal && (
        <SettingsModal
          open={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentUser={currentUser}
          onOpenAuth={() => {
            setShowSettingsModal(false)
            setShowAuthModal(true)
          }}
          onLogout={handleLogout}
          onClearAllSessions={handleClearAllSessions}
        />
      )}
    </AppShell>
  )
}
