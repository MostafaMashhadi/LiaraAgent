import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, Copy, Check, Mic, MicOff, BookOpen, Clock, ArrowLeft, RefreshCw } from 'lucide-react';
import { marked } from 'marked';

export default function ChatView({ 
  messages, 
  onSendMessage, 
  streamingBuffer, 
  isStreaming, 
  activeCategory,
  onClearSession
}) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const chatEndRef = useRef(null);

  // Configure custom code syntax highlighter & copy buttons for marked
  useEffect(() => {
    const renderer = new marked.Renderer();
    renderer.code = function(tokenOrCode, maybeLang) {
      let code = '';
      let lang = '';
      if (typeof tokenOrCode === 'object' && tokenOrCode !== null) {
        code = tokenOrCode.text || tokenOrCode.raw || '';
        lang = tokenOrCode.lang || '';
      } else {
        code = tokenOrCode || '';
        lang = maybeLang || '';
      }

      if (typeof code !== 'string') {
        code = String(code);
      }

      const language = lang && window.hljs && window.hljs.getLanguage(lang) ? lang : '';
      let highlighted = code;
      if (window.hljs) {
        try {
          highlighted = language 
            ? window.hljs.highlight(code, { language }).value 
            : window.hljs.highlightAuto(code).value;
        } catch (e) {
          highlighted = code;
        }
      }
      const langLabel = (language || lang || 'code').toUpperCase();
      const codeId = 'code_' + Math.random().toString(36).substring(2, 9);
      
      return `
        <div class="code-block-wrapper my-3 rounded-xl overflow-hidden border border-[#27272a] bg-[#0d0d10] text-left" dir="ltr">
          <div class="flex items-center justify-between px-3.5 py-1.5 bg-[#18181b] border-b border-[#27272a] text-[11px] text-[#a1a1aa] font-mono select-none">
            <span class="font-semibold text-[#60a5fa]">${langLabel}</span>
            <button onclick="window.copyCodeBlock('${codeId}')" class="flex items-center gap-1 hover:text-white transition px-2 py-0.5 rounded bg-[#27272a] hover:bg-[#3f3f46]">
              <span id="btn_${codeId}">📋 کپی کد</span>
            </button>
          </div>
          <pre class="p-3.5 overflow-x-auto text-xs leading-relaxed font-mono"><code id="${codeId}" class="hljs ${language}">${highlighted}</code></pre>
        </div>
      `;
    };
    marked.use({ renderer, breaks: true, gfm: true });

    window.copyCodeBlock = function(id) {
      const elem = document.getElementById(id);
      if (!elem) return;
      const text = elem.innerText || elem.textContent;
      navigator.clipboard.writeText(text);
      const btn = document.getElementById('btn_' + id);
      if (btn) {
        btn.innerText = '✅ کپی شد!';
        setTimeout(() => {
          btn.innerText = '📋 کپی کد';
        }, 2000);
      }
    };
  }, []);

  // Syntax highlighting effect
  useEffect(() => {
    if (window.hljs) {
      document.querySelectorAll('pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
  }, [messages, streamingBuffer]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Web Speech API for voice input
  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند. لطفاً از مرورگرهای Chrome یا Edge استفاده کنید.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'fa-IR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const samplePrompts = [
    { title: 'استقرار Node.js', icon: Sparkles, prompt: 'چطور یک برنامه Node.js را در پلتفرم لیارا دیپلوی کنم؟' },
    { title: 'کانفیگ liara.json لاراول', icon: Sparkles, prompt: 'فایل liara.json برای فریم‌ورک لاراول چگونه تنظیم می‌شود؟' },
    { title: 'اتصال به دیتابیس PostgreSQL', icon: Sparkles, prompt: 'نحوه اتصال برنامه به دیتابیس PostgreSQL با شبکه خصوصی چگونه است؟' },
    { title: 'رفع خطای 502 Bad Gateway', icon: Sparkles, prompt: 'دلیل خطای 502 Bad Gateway بعد از استقرار چیست و چطور رفع می‌شود؟' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-4xl w-full mx-auto">
        {/* Welcome Card if no messages yet */}
        {messages.length === 0 && (
          <div className="liara-card p-6 border border-[#ffffff15] text-[#eeeeee] space-y-4 my-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0076ff]/20 border border-[#0076ff]/40 flex items-center justify-center text-[#38bdf8]">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">دستیار هوشمند ابری لیارا</h2>
                <p className="text-xs text-[#a0aec0]">آماده راهنمایی در استقرار، دیباگ لاگ‌های خطا و تولید فایل‌های کانفیگ</p>
              </div>
            </div>

            <p className="text-xs text-[#cbd5e1] leading-relaxed">
              شما می‌توانید هرگونه سوال درباره نحوه دیپلوی فریم‌ورک‌های مختلف (Node.js, Next.js, Django, Laravel, Go, Docker)، تنظیم دیتابیس‌ها، اتصال دیسک‌های ابری و رفع خطاهای استقرار را بپرسید.
            </p>

            <div className="pt-3 border-t border-[#333333]">
              <p className="text-[11px] font-semibold text-[#a0aec0] mb-2.5">
                پرسش‌های پرکاربرد برای شروع:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {samplePrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => onSendMessage(p.prompt)}
                    className="text-right p-2.5 rounded-xl bg-[#252525] hover:bg-[#2e2e2e] border border-[#383838] hover:border-[#0076ff]/50 text-xs text-[#e2e8f0] transition flex items-center justify-between group"
                  >
                    <span>{p.title}</span>
                    <ArrowLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#38bdf8]" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Thread */}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3.5 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#0076ff] to-[#00c6ff] flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-blue-500/20">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#0076ff] text-white rounded-tl-sm shadow-md'
                  : 'liara-card text-[#eeeeee] rounded-tr-sm'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <>
                  {/* Assistant Markdown Body */}
                  <div
                    className="markdown-body"
                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') }}
                  />

                  {/* Cited Verified Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#333333]">
                      <p className="text-[11px] font-semibold text-[#a0aec0] mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#38bdf8]" />
                        <span>منابع و مستندات رسمی لیارا:</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, sIdx) => (
                          <a
                            key={sIdx}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs bg-[#2a2a2a] hover:bg-[#333333] text-[#38bdf8] border border-[#38bdf8]/30 hover:border-[#38bdf8] px-2.5 py-1 rounded-lg transition flex items-center gap-1.5"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>{src.title || 'مستند مرتبط'}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contextual Dynamic Next-Steps */}
                  {msg.suggested_next && msg.suggested_next.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-[#333333]/80">
                      <p className="text-[11px] font-semibold text-[#a0aec0] mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>مراحل پیشنهادی بعدی (اقدام فوری):</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggested_next.map((step, stepIdx) => (
                          <button
                            key={stepIdx}
                            onClick={() => onSendMessage(step)}
                            className="text-xs bg-[#242424] hover:bg-[#0076ff]/20 border border-[#3d3d3d] hover:border-[#0076ff]/50 text-[#e2e8f0] hover:text-[#38bdf8] px-2.5 py-1 rounded-lg transition flex items-center gap-1 text-right"
                          >
                            <span>{step}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer metadata & copy */}
                  <div className="mt-3 pt-2 flex items-center justify-between text-[10px] text-[#718096]">
                    {msg.duration_ms ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>زمان پاسخ: {msg.duration_ms}ms</span>
                      </span>
                    ) : <span />}
                    <button
                      onClick={() => handleCopy(msg.content, idx)}
                      className="flex items-center gap-1 hover:text-[#eeeeee] transition"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">کپی شد</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>کپی پاسخ</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-[#2d3748] flex-shrink-0 flex items-center justify-center text-xs font-bold text-white">
                <User className="w-4 h-4 text-[#cbd5e1]" />
              </div>
            )}
          </div>
        ))}

        {/* Live Streaming Bubble */}
        {isStreaming && (
          <div className="flex items-start gap-3.5 justify-start">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#0076ff] to-[#00c6ff] flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-blue-500/20 animate-pulse">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="liara-card p-4 rounded-2xl rounded-tr-sm max-w-[85%] text-sm leading-relaxed">
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(streamingBuffer || ''),
                }}
              />
              <span className="inline-block w-2 h-4 bg-[#0076ff] animate-pulse mr-1 mt-1" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="p-4 bg-[#1e1e1e] border-t border-[#2e2e2e]">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="سوال خود را درباره سرویس‌های لیارا بنویسید یا لاگ خطا را پیست کنید..."
              className="w-full bg-[#141414] border border-[#333333] focus:border-[#0076ff] focus:ring-1 focus:ring-[#0076ff] text-[#eeeeee] text-xs md:text-sm rounded-xl py-3.5 pr-4 pl-28 resize-none outline-none transition placeholder:text-[#64748b]"
            />

            <div className="absolute left-2.5 flex items-center gap-1.5">
              {/* Voice recognition */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-2 rounded-lg text-xs transition ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'text-[#a0aec0] hover:text-white hover:bg-[#282828]'
                }`}
                title="ورودی صوتی (فارسی)"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Clear chat */}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={onClearSession}
                  className="p-2 text-[#a0aec0] hover:text-white hover:bg-[#282828] rounded-lg transition"
                  title="پاک کردن چت"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              {/* Send */}
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="bg-[#0076ff] hover:bg-[#0062d6] disabled:opacity-40 disabled:hover:bg-[#0076ff] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-md shadow-blue-500/20"
              >
                <span>ارسال</span>
                <Send className="w-3.5 h-3.5 transform rotate-180" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
