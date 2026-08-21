import React, { useState, useEffect, useRef } from 'react'
import { LuBot, LuCopy, LuCheck, LuMic, LuMicOff, LuBookOpen, LuClock, LuArrowLeft, LuSparkles } from 'react-icons/lu'
import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { ChatMessage, DocSource } from '@/types'

interface ChatViewProps {
  messages: ChatMessage[]
  onSendMessage: (text: string) => void
  streamingBuffer: string
  isStreaming: boolean
  onClearSession: () => void
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2 py-2" aria-label="در حال نوشتن">
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-primary/70 animate-[thinking_1.4s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
        <span className="w-2 h-2 rounded-full bg-primary/50 animate-[thinking_1.4s_ease-in-out_infinite]" style={{ animationDelay: '0.2s' }} />
        <span className="w-2 h-2 rounded-full bg-primary/30 animate-[thinking_1.4s_ease-in-out_infinite]" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c.05.36.17.71.37 1.02l8.31 12.14c.43.62 1.25.79 1.87.37.19-.13.35-.3.47-.49l5.14-8.39" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChatView({ messages, onSendMessage, streamingBuffer, isStreaming }: ChatViewProps) {
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isEmptyState = messages.length === 0 && !isStreaming

  useEffect(() => {
    if (!isEmptyState) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingBuffer, isEmptyState])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [input])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isStreaming) return
    onSendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'fa-IR'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (event: { results: unknown[][] }) => {
      const transcript = (event.results[0][0] as { transcript: string }).transcript
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
      setIsListening(false)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognition.start()
  }

  const samplePrompts = [
    { title: 'استقرار Node.js', prompt: 'چطور یک برنامه Node.js را در پلتفرم لیارا دیپلوی کنم؟' },
    { title: 'کانفیگ liara.json لاراول', prompt: 'فایل liara.json برای فریم‌ورک لاراول چگونه تنظیم می‌شود؟' },
    { title: 'اتصال به دیتابیس PostgreSQL', prompt: 'نحوه اتصال برنامه به دیتابیس PostgreSQL با شبکه خصوصی چگونه است؟' },
    { title: 'رفع خطای 502 Bad Gateway', prompt: 'دلیل خطای 502 Bad Gateway بعد از استقرار چیست و چطور رفع می‌شود؟' },
  ]

  const composerForm = (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-end gap-1.5 rounded-[26px] border border-border bg-card p-2 elevation-2 focus-within:border-ring/60 transition-all duration-300"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="سوال خود را بنویسید..."
        dir="rtl"
        className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed placeholder:text-muted-foreground focus:outline-none max-h-[200px]"
      />

      <div className="flex items-center gap-0.5 pb-0.5 pl-0.5">
        <button
          type="button"
          onClick={toggleVoiceInput}
          aria-label="ورودی صوتی"
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
            isListening && 'bg-destructive/10 text-destructive hover:text-destructive animate-pulse'
          )}
        >
          {isListening ? <LuMicOff className="h-[18px] w-[18px]" /> : <LuMic className="h-[18px] w-[18px]" />}
        </button>

        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          aria-label="ارسال پیام"
          className={cn(
            'ml-1 h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200',
            input.trim() && !isStreaming
              ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          <SendIcon />
        </button>
      </div>
    </form>
  )

  const welcomeHero = (
    <div className="flex flex-col items-center text-center w-full">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary mb-5">
        <LuBot className="w-7 h-7" />
      </div>
      <h1 className="text-2xl md:text-[28px] font-semibold text-foreground tracking-tight mb-2">
        با چه کاری می‌توانم کمکتان کنم؟
      </h1>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-8">
        سوال خود را درباره استقرار، دیباگ لاگ‌ها یا تنظیمات سرویس‌های لیارا بپرسید.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
        {samplePrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => onSendMessage(p.prompt)}
            className="text-right p-3.5 rounded-2xl bg-card border border-border hover:bg-muted/60 hover:border-primary/40 text-sm transition-colors duration-150 flex items-center justify-between gap-2 group"
          >
            <span className="font-medium text-foreground">{p.title}</span>
            <LuArrowLeft className="w-4 h-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {isEmptyState ? (
        /* Centered welcome layout: hero + composer grouped & centered on screen */
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-center px-4 md:px-6 py-10">
            <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
              {welcomeHero}
              <div className="w-full mt-8">{composerForm}</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl w-full mx-auto px-4 md:px-6 py-6 space-y-6">
              {/* Message Thread */}
              {messages.map((msg, idx) =>
                msg.role === 'user' ? (
                  <div key={idx} className="flex justify-end">
                    <div className="max-w-[85%] md:max-w-[75%] rounded-3xl bg-primary text-primary-foreground px-4 py-2.5">
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div key={idx} className="group/msg flex items-start gap-3">
                    <div className="w-7 h-7 mt-0.5 rounded-lg bg-primary/10 border border-primary/15 shrink-0 flex items-center justify-center text-primary">
                      <LuBot className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className="markdown-body text-[15px] text-foreground"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '') }}
                      />

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                            <LuBookOpen className="w-3.5 h-3.5 text-primary" />
                            <span>منابع:</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src: DocSource, sIdx: number) => (
                              <a
                                key={sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs bg-muted hover:bg-accent text-muted-foreground hover:text-foreground border border-border px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5"
                              >
                                <LuBookOpen className="w-3 h-3 text-primary" />
                                <span>{src.title || 'مستند مرتبط'}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.suggested_next && msg.suggested_next.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                            <LuSparkles className="w-3.5 h-3.5 text-gold" />
                            <span>مراحل پیشنهادی:</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggested_next.map((step: string, stepIdx: number) => (
                              <button
                                key={stepIdx}
                                onClick={() => onSendMessage(step)}
                                className="text-xs bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-full transition-colors"
                              >
                                {step}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-3 text-muted-foreground">
                        <button
                          onClick={() => handleCopy(msg.content, idx)}
                          className="flex items-center gap-1 text-xs hover:text-foreground transition-colors"
                          aria-label="کپی پاسخ"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <LuCheck className="w-3.5 h-3.5 text-mint" />
                              <span className="text-mint">کپی شد</span>
                            </>
                          ) : (
                            <>
                              <LuCopy className="w-3.5 h-3.5" />
                              <span>کپی</span>
                            </>
                          )}
                        </button>
                        {msg.duration_ms ? (
                          <span className="flex items-center gap-1 text-xs">
                            <LuClock className="w-3 h-3" />
                            <span>{msg.duration_ms}ms</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Live Streaming Bubble */}
              {isStreaming && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 mt-0.5 rounded-lg bg-primary/10 border border-primary/15 shrink-0 flex items-center justify-center text-primary">
                    <LuBot className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {streamingBuffer ? (
                      <div
                        className="markdown-body text-[15px] text-foreground"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(streamingBuffer),
                        }}
                      />
                    ) : (
                      <ThinkingDots />
                    )}
                    {streamingBuffer && (
                      <span className="inline-block w-2 h-4 bg-primary/80 animate-pulse rounded-sm align-middle mr-0.5" />
                    )}
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Fixed Bottom Composer */}
          <div className="shrink-0 px-4 pb-4 md:px-6 md:pb-5 pt-2 bg-gradient-to-t from-background via-background to-transparent animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-3xl mx-auto">
              {composerForm}
              <p className="text-center text-[11px] text-muted-foreground mt-2">
                پاسخ‌ها توسط هوش مصنوعی تولید می‌شوند و ممکن است نیاز به بازبینی داشته باشند.
              </p>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes thinking {
          0%, 100% { transform: scale(0.6); opacity: 0.3; }
          50% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
