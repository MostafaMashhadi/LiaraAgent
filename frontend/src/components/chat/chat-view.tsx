import React, { useState, useEffect, useRef } from 'react';
import { LuSend, LuBot, LuUser, LuSparkles, LuCopy, LuCheck, LuMic, LuMicOff, LuBookOpen, LuClock, LuArrowLeft, LuRefreshCw } from 'react-icons/lu';
import { marked } from 'marked';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { url: string; title?: string }[];
  suggested_next?: string[];
  duration_ms?: number;
}

interface ChatViewProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  streamingBuffer: string;
  isStreaming: boolean;
  onClearSession: () => void;
}

export default function ChatView({ messages, onSendMessage, streamingBuffer, isStreaming, onClearSession }: ChatViewProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const renderer = new marked.Renderer();
    renderer.code = function (tokenOrCode, maybeLang) {
      let code = '';
      let lang = '';
      if (typeof tokenOrCode === 'object' && tokenOrCode !== null) {
        code = tokenOrCode.text || tokenOrCode.raw || '';
        lang = tokenOrCode.lang || '';
      } else {
        code = tokenOrCode || '';
        lang = maybeLang || '';
      }

      if (typeof code !== 'string') code = String(code);

      const language = lang && typeof window !== 'undefined' && window.hljs?.getLanguage(lang) ? lang : '';
      let highlighted = code;
      if (typeof window !== 'undefined' && window.hljs) {
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
        <div class="code-block-wrapper my-3 rounded-xl overflow-hidden border border-border bg-muted">
          <div class="code-block-header">
            <span class="font-semibold text-primary">${langLabel}</span>
            <button onclick="window.copyCodeBlock('${codeId}')" class="flex items-center gap-1 hover:text-white transition px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-xs">
              <span id="btn_${codeId}">کپی کد</span>
            </button>
          </div>
          <pre class="code-block-body"><code id="${codeId}" class="hljs ${language}">${highlighted}</code></pre>
        </div>
      `;
    };
    marked.use({ renderer, breaks: true, gfm: true });

    if (typeof window !== 'undefined') {
      window.copyCodeBlock = function (id) {
        const elem = document.getElementById(id);
        if (!elem) return;
        const text = elem.innerText || elem.textContent;
        navigator.clipboard.writeText(text);
        const btn = document.getElementById('btn_' + id);
        if (btn) {
          btn.innerText = 'کپی شد!';
          setTimeout(() => {
            btn.innerText = 'کپی کد';
          }, 2000);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.hljs) {
      document.querySelectorAll('pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
  }, [messages, streamingBuffer]);

  const handleSubmit = (e) => {
    e?.preventDefault();
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

  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند.');
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
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        <div className="max-w-4xl w-full mx-auto">
          {/* Welcome Card if no messages yet */}
          {messages.length === 0 && (
            <div className="gradient-banner rounded-2xl p-6 md:p-8 border border-primary/20 elevation-2 animate-in">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-primary flex items-center justify-center text-white shadow-lg shadow-teal-500/20 elevation-2">
                  <LuBot className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">دستیار هوشمند ابری لیارا</h2>
                  <p className="text-sm text-muted-foreground">آماده راهنمایی در استقرار، دیباگ لاگ‌های خطا و تولید فایل‌های کانفیگ</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                شما می‌توانید هرگونه سوال درباره نحوه دیپلوی فریم‌ورک‌های مختلف (Node.js, Next.js, Django, Laravel, Go, Docker)، تنظیم دیتابیس‌ها، اتصال دیسک‌های ابری و رفع خطاهای استقرار را بپرسید.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {samplePrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => onSendMessage(p.prompt)}
                    className="text-right p-4 rounded-xl bg-card border border-border hover:border-primary/50 text-sm text-foreground transition-all duration-200 elevation-1 hover:elevation-2 flex items-center justify-between group"
                  >
                    <span className="font-medium">{p.title}</span>
                    <LuArrowLeft className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Thread */}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-4 animate-slide-in-right',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-primary flex-shrink-0 flex items-center justify-center text-white shadow-md shadow-teal-500/20 elevation-1">
                  <LuBot className="w-4 h-4" />
                </div>
              )}

              <Card
                className={cn(
                  'max-w-[85%] rounded-2xl elevation-1 transition-all duration-300 hover:elevation-2',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tl-sm shadow-lg shadow-primary/20'
                    : 'bg-card text-card-foreground rounded-tr-sm'
                )}
              >
                <div className="p-4 md:p-5">
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <>
                      <div
                        className="markdown-body text-sm"
                        dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') }}
                      />

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <LuBookOpen className="w-3.5 h-3.5 text-primary" />
                            <span>منابع و مستندات رسمی لیارا:</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs bg-muted hover:bg-muted/80 text-foreground border border-border hover:border-primary px-2.5 py-1.5 rounded-xl transition-all duration-200 flex items-center gap-1.5"
                              >
                                <LuBookOpen className="w-3 h-3 text-primary" />
                                <span>{src.title || 'مستند مرتبط'}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.suggested_next && msg.suggested_next.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                            <LuSparkles className="w-3.5 h-3.5 text-gold" />
                            <span>مراحل پیشنهادی بعدی:</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.suggested_next.map((step, stepIdx) => (
                              <button
                                key={stepIdx}
                                onClick={() => onSendMessage(step)}
                                className="text-xs bg-muted hover:bg-primary hover:text-primary-foreground border border-border hover:border-primary px-3 py-1.5 rounded-xl transition-all duration-200"
                              >
                                {step}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 pt-2 flex items-center justify-between text-xs text-muted-foreground">
                        {msg.duration_ms ? (
                          <span className="flex items-center gap-1">
                            <LuClock className="w-3 h-3" />
                            <span>زمان پاسخ: {msg.duration_ms}ms</span>
                          </span>
                        ) : <span />}
                        <button
                          onClick={() => handleCopy(msg.content, idx)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <LuCheck className="w-3 h-3 text-mint" />
                              <span className="text-mint">کپی شد</span>
                            </>
                          ) : (
                            <>
                              <LuCopy className="w-3 h-3" />
                              <span>کپی پاسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              {msg.role === 'user' && (
                <div className="w-9 h-9 rounded-xl bg-muted flex-shrink-0 flex items-center justify-center text-foreground elevation-1">
                  <LuUser className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {/* Live Streaming Bubble */}
          {isStreaming && (
            <div className="flex items-start gap-4 justify-start animate-slide-in-left">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-primary flex-shrink-0 flex items-center justify-center text-white shadow-md shadow-teal-500/20 elevation-1 animate-pulse">
                <LuBot className="w-4 h-4" />
              </div>
              <Card className="rounded-2xl rounded-tr-sm max-w-[85%] elevation-1">
                <div className="p-4 md:p-5">
                  <div
                    className="markdown-body text-sm"
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(streamingBuffer || ''),
                    }}
                  />
                  <span className="inline-block w-2 h-4 bg-primary animate-pulse mr-1 mt-1" />
                </div>
              </Card>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Box Footer */}
      <div className="shrink-0 p-4 border-t border-border bg-card/80 backdrop-blur-xl elevation-1">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="سوال خود را درباره سرویس‌های لیارا بنویسید..."
                className="min-h-[48px] max-h-32 resize-none rounded-2xl pr-4 pl-28 py-3 text-sm"
              />
            </div>

            <div className="absolute left-2 bottom-2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleVoiceInput}
                className={cn(
                  'h-9 w-9 rounded-xl',
                  isListening && 'bg-destructive/10 text-destructive animate-pulse'
                )}
              >
                {isListening ? <LuMicOff className="h-4 w-4" /> : <LuMic className="h-4 w-4" />}
              </Button>

              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClearSession}
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <LuRefreshCw className="h-4 w-4" />
                </Button>
              )}

              <Button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="h-9 px-4 rounded-xl shadow-teal-glow"
              >
                <span className="hidden sm:inline">ارسال</span>
                <LuSend className="h-4 w-4 transform rotate-180" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

