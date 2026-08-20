import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatView from './components/ChatView.jsx';
import ConfigStudio from './components/ConfigStudio.jsx';
import LogDebugger from './components/LogDebugger.jsx';
import DocsExplorer from './components/DocsExplorer.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import AuthModal from './components/AuthModal.jsx';

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

  // Save sessions to localStorage as cache
  useEffect(() => {
    try {
      localStorage.setItem('liara_sessions', JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  // Load sessions from PostgreSQL on startup / login
  const fetchDBSessions = async () => {
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
  };

  // Load messages for active session from PostgreSQL
  const fetchSessionMessages = async (sessId) => {
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
  };

  useEffect(() => {
    fetchDBSessions();
  }, [authToken]);

  useEffect(() => {
    if (activeSessionId) {
      const target = sessions.find((s) => s.id === activeSessionId);
      if (!target || !target.messages || target.messages.length === 0) {
        fetchSessionMessages(activeSessionId);
      }
    }
  }, [activeSessionId]);

  // Check auth validity on mount
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

  // Current session's messages
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

  // WebSocket connection
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

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partial = '';

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
            content: `**خطا در ارتباط با سرور:**\n\n${err.message}`,
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#181818] text-[#eeeeee]">
      {/* Top Header */}
      <Header
        isWsConnected={isWsConnected}
        onNewChat={handleNewSession}
        currentUser={currentUser}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          currentUser={currentUser}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#181818]">
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
        </main>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
