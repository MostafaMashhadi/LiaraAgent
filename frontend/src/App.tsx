import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppShell from '@/components/layout/app-shell';
import AuthModal from '@/components/auth/auth-modal';
import ChatView from '@/components/chat/chat-view';
import ConfigStudio from '@/components/config/config-studio';
import LogDebugger from '@/components/logs/log-debugger';
import DocsExplorer from '@/components/docs/docs-explorer';
import AdminDashboard from '@/components/admin/admin-dashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('liara_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('liara_auth_token') || '');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('liara_sessions');
      return saved ? JSON.parse(saved) : [{ id: 'sess_default', title: 'گفتگوی جاری', messages: [] }];
    } catch {
      return [{ id: 'sess_default', title: 'گفتگوی جاری', messages: [] }];
    }
  });
  const [activeSessionId, setActiveSessionId] = useState('sess_default');
  const [streamingBuffer, setStreamingBuffer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);

  const wsRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('liara_sessions', JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  const fetchDBSessions = useCallback(async () => {
    try {
      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/api/chat/sessions', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && data.sessions.length > 0) {
          setSessions((prev) => {
            const merged = data.sessions.map((dbSess) => {
              const existing = prev.find((p) => p.id === dbSess.id);
              return {
                id: dbSess.id,
                title: dbSess.title,
                summary: dbSess.summary,
                messages: existing ? existing.messages : [],
              };
            });
            return merged;
          });
        }
      }
    } catch (e) {}
  }, [authToken]);

  const fetchSessionMessages = useCallback(async (sessId) => {
    try {
      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch(`/api/chat/messages?session_id=${sessId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          const parsed = data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            sources: m.sources,
            suggested_next: m.suggested_next,
            duration_ms: m.duration_ms,
          }));
          setSessions((prev) =>
            prev.map((s) => (s.id === sessId ? { ...s, messages: parsed } : s))
          );
        }
      }
    } catch (e) {}
  }, [authToken]);

  useEffect(() => {
    fetchDBSessions();
  }, [fetchDBSessions]);

  useEffect(() => {
    if (activeSessionId) {
      const target = sessions.find((s) => s.id === activeSessionId);
      if (!target || !target.messages || target.messages.length === 0) {
        fetchSessionMessages(activeSessionId);
      }
    }
  }, [activeSessionId, sessions, fetchSessionMessages]);

  useEffect(() => {
    if (authToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('liara_auth_user', JSON.stringify(data.user));
          } else {
            handleLogout();
          }
        })
        .catch(() => {});
    }
  }, [authToken]);

  const handleLoginSuccess = (token, user) => {
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem('liara_auth_token', token);
    localStorage.setItem('liara_auth_user', JSON.stringify(user));
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    localStorage.removeItem('liara_auth_token');
    localStorage.removeItem('liara_auth_user');
    if (activeTab === 'admin') setActiveTab('chat');
  };

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = currentSession ? currentSession.messages : [];

  const updateSessionMessages = (updater) => {
    setSessions((prevSessions) =>
      prevSessions.map((s) => {
        if (s.id === activeSessionId) {
          const newMessages = typeof updater === 'function' ? updater(s.messages) : updater;
          let newTitle = s.title;
          if (s.title === 'گفتگوی جاری' || s.title === 'گفتگوی جدید') {
            const firstUser = newMessages.find((m) => m.role === 'user');
            if (firstUser) {
              newTitle = firstUser.content.slice(0, 30) + (firstUser.content.length > 30 ? '...' : '');
            }
          }
          return { ...s, messages: newMessages, title: newTitle };
        }
        return s;
      })
    );
  };

  useEffect(() => {
    let ws;
    const connectWS = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/chat${authToken ? '?token=' + authToken : ''}`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setIsWsConnected(true);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleIncomingStream(data);
          } catch (e) {
            console.error('Error parsing WS message', e);
          }
        };
        ws.onclose = () => {
          setIsWsConnected(false);
          setTimeout(connectWS, 3000);
        };
        ws.onerror = () => ws.close();
      } catch (err) {
        setIsWsConnected(false);
      }
    };

    connectWS();
    return () => {
      if (ws) ws.close();
    };
  }, [activeSessionId, authToken]);

  const handleIncomingStream = (data) => {
    if (data.type === 'token') {
      setIsStreaming(true);
      setStreamingBuffer((prev) => prev + data.token);
    } else if (data.type === 'done') {
      setIsStreaming(false);
      setStreamingBuffer('');
      updateSessionMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          sources: data.sources,
          suggested_next: data.suggested_next,
          duration_ms: data.duration_ms,
        },
      ]);
      fetchDBSessions();
    } else if (data.type === 'error') {
      setIsStreaming(false);
      setStreamingBuffer('');
      updateSessionMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**خطا:** ${data.error || 'خطای پردازش درخواست'}`,
        },
      ]);
    }
  };

  const handleSendMessage = async (text) => {
    if (!text || isStreaming) return;

    updateSessionMessages((prev) => [...prev, { role: 'user', content: text }]);
    setStreamingBuffer('');
    setIsStreaming(true);

    if (isWsConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          message: text,
          session_id: activeSessionId,
        })
      );
    } else {
      try {
        const headers = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch('/api/chat?stream=true', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            message: text,
            session_id: activeSessionId,
          }),
        });

        if (!res.ok) {
          const raw = await res.text();
          throw new Error(raw || 'خطای ارتباط با سرور');
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        let partial = '';

        if (!reader) throw new Error('No reader available');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          partial += decoder.decode(value, { stream: true });
          const lines = partial.split('\n');
          partial = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            try {
              const data = JSON.parse(jsonStr);
              handleIncomingStream(data);
            } catch (e) {}
          }
        }
      } catch (err) {
        setIsStreaming(false);
        setStreamingBuffer('');
        updateSessionMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**خطا در ارتباط با سرور:**\n\n${err instanceof Error ? err.message : 'خطای ناشناخته'}`,
          },
        ]);
      }
    }
  };

  const handleNewSession = () => {
    const newId = 'sess_' + Math.random().toString(36).substring(2, 9);
    const newSession = { id: newId, title: 'گفتگوی جدید', summary: '', messages: [] };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setStreamingBuffer('');
    setIsStreaming(false);
    setActiveTab('chat');
  };

  const handleDeleteSession = async (sessId) => {
    try {
      const headers = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      await fetch(`/api/chat/sessions?session_id=${sessId}`, {
        method: 'DELETE',
        headers,
      });
    } catch (e) {}

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessId);
      if (filtered.length === 0) {
        const fresh = { id: 'sess_' + Math.random().toString(36).substring(2, 9), title: 'گفتگوی جدید', summary: '', messages: [] };
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleClearCurrentSession = () => {
    updateSessionMessages([]);
    setStreamingBuffer('');
    setIsStreaming(false);
  };

  const handleSearch = (query) => {
    if (query.trim()) {
      setActiveTab('docs');
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelectSession={setActiveSessionId}
      onNewSession={handleNewSession}
      onDeleteSession={handleDeleteSession}
      isWsConnected={isWsConnected}
      currentUser={currentUser}
      onNewChat={handleNewSession}
      onOpenAuth={() => setShowAuthModal(true)}
      onLogout={handleLogout}
      onSearch={handleSearch}
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

      {activeTab === 'config' && <ConfigStudio authToken={authToken} />}

      {activeTab === 'logs' && <LogDebugger authToken={authToken} />}

      {activeTab === 'docs' && <DocsExplorer />}

      {activeTab === 'admin' && <AdminDashboard authToken={authToken} />}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </AppShell>
  );
}
