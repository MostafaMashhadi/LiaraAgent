import React from 'react';
import { 
  MessageSquare, 
  Settings2, 
  Bug, 
  BookOpen, 
  Plus, 
  Trash2,
  ExternalLink,
  Shield,
  HelpCircle
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  sessions = [], 
  activeSessionId, 
  onSelectSession, 
  onNewSession,
  onDeleteSession,
  currentUser
}) {
  const tools = [
    { id: 'chat', label: 'دستیار گفتگو', icon: MessageSquare },
    { id: 'config', label: 'سازنده کانفیگ liara.json', icon: Settings2 },
    { id: 'logs', label: 'عیب‌یاب و تحلیل لاگ', icon: Bug },
    { id: 'docs', label: 'بانک مستندات رسمی', icon: BookOpen },
  ];

  return (
    <aside className="w-64 bg-[#222222] border-l border-[#ffffff15] flex flex-col justify-between p-3.5 select-none shrink-0 hidden md:flex">
      <div className="space-y-5">
        {/* New Chat Action */}
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 liara-btn-primary py-2.5 px-3 rounded-xl text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>شروع گفتگوی جدید</span>
        </button>

        {/* Primary Tools Navigation */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7a8a94] mb-2 px-2">
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? 'bg-[#181818] text-white font-semibold border border-[#ffffff20] shadow-sm'
                      : 'text-[#a0acb7] hover:bg-[#282828] hover:text-[#ffffff]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#38bdf8]' : 'text-[#7a8a94]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Admin Dashboard Tab (Only if admin) */}
            {currentUser && currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                  activeTab === 'admin'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-sm'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>پنل مدیریت و لاگ توکن‌ها</span>
              </button>
            )}
          </nav>
        </div>

        {/* Recent Conversations */}
        {sessions && sessions.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7a8a94] mb-2 px-2">
              تاریخچه گفتگوها
            </p>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {sessions.map((sess) => {
                const isSelected = activeSessionId === sess.id;
                return (
                  <div
                    key={sess.id}
                    onClick={() => {
                      onSelectSession(sess.id);
                      setActiveTab('chat');
                    }}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-[#181818] text-white font-medium border border-[#ffffff15]'
                        : 'text-[#a0acb7] hover:bg-[#282828] hover:text-[#ffffff]'
                    }`}
                  >
                    <div className="flex items-start gap-2 overflow-hidden min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#7a8a94] mt-0.5" />
                      <div className="truncate text-right min-w-0">
                        <p className="truncate text-right font-medium">{sess.title || 'گفتگوی بدون عنوان'}</p>
                        {sess.summary && (
                          <p className="text-[10px] text-[#7a8a94] truncate">{sess.summary}</p>
                        )}
                      </div>
                    </div>
                    {onDeleteSession && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(sess.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition shrink-0 mr-1"
                        title="حذف گفتگو"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Support / Docs Links */}
      <div className="pt-3 border-t border-[#ffffff15] space-y-1">
        <a
          href="https://liara.ir/contact"
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] text-[#7a8a94] hover:text-[#eeeeee] hover:bg-[#282828] transition"
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>پشتیبانی و تیکت لیارا</span>
          </span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      </div>
    </aside>
  );
}
