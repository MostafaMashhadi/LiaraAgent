import React, { useState, useEffect, useRef } from 'react'
import { LuArrowUp, LuBot, LuCopy, LuCheck, LuBookOpen, LuClock, LuArrowLeft, LuSparkles, LuSquare } from 'react-icons/lu'
import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { ChatMessage, DocSource } from '@/types'

interface ChatViewProps {
  messages: ChatMessage[]
  onSendMessage: (text: string) => void
  onStopMessage: () => void
  streamingBuffer: string
  isStreaming: boolean
}

export function ChatView({ messages, onSendMessage, onStopMessage, streamingBuffer, isStreaming }: ChatViewProps) {
  const [input, setInput] = useState('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const messagesViewportRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const viewport = messagesViewportRef.current
    if (!viewport || !shouldAutoScrollRef.current) return

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: streamingBuffer ? 'auto' : 'smooth',
    })
  }, [messages.length, streamingBuffer])

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
    navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const handleMessagesScroll = () => {
    const viewport = messagesViewportRef.current
    if (!viewport) return
    shouldAutoScrollRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80
  }

  const samplePrompts = [
    { title: 'استقرار Node.js', prompt: 'چطور یک برنامه Node.js را در پلتفرم لیارا دیپلوی کنم؟' },
    { title: 'کانفیگ liara.json لاراول', prompt: 'فایل liara.json برای فریم‌ورک لاراول چگونه تنظیم می‌شود؟' },
    { title: 'اتصال به دیتابیس PostgreSQL', prompt: 'نحوه اتصال برنامه به دیتابیس PostgreSQL با شبکه خصوصی چگونه است؟' },
    { title: 'رفع خطای 502 Bad Gateway', prompt: 'دلیل خطای 502 Bad Gateway بعد از استقرار چیست و چطور رفع می‌شود؟' },
  ]

  const isEmpty = messages.length === 0 && !isStreaming

  const composer = (
    <div
      className={cn(
        'z-20 w-full shrink-0 bg-gradient-to-t from-background via-background to-transparent px-4 pb-4 pt-2 md:px-6 md:pb-5',
        isEmpty
          ? 'md:pointer-events-none md:absolute md:inset-x-0 md:top-1/2 md:-translate-y-1/2 md:pb-0 md:pt-0'
          : ''
      )}
    >
      <div className="pointer-events-auto mx-auto max-w-4xl">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end gap-2 rounded-[26px] border border-border bg-card p-2 elevation-2 transition-colors focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/15"
        >
          <label htmlFor="chat-message" className="sr-only">پیام شما</label>
          <textarea
            id="chat-message"
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="سوال خود را بنویسید..."
            dir="rtl"
            className="flex-1 resize-none bg-transparent px-3 py-3 text-base sm:text-[15px] leading-relaxed placeholder:text-muted-foreground focus:outline-none max-h-[200px]"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStopMessage}
              aria-label="توقف پاسخ"
              className="mb-0.5 ml-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-teal-glow active:scale-95"
            >
              <LuSquare className="h-4 w-4 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="ارسال پیام"
              className="mb-0.5 ml-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-all hover:scale-105 hover:bg-primary/90 hover:shadow-teal-glow active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
            >
              <LuArrowUp className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </form>

        <p className="text-center text-[11px] text-muted-foreground mt-2">
          پاسخ‌ها توسط هوش مصنوعی تولید می‌شوند و ممکن است نیاز به بازبینی داشته باشند.
        </p>
      </div>
    </div>
  )

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Messages Scroll Area */}
      <div ref={messagesViewportRef} onScroll={handleMessagesScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn('max-w-4xl w-full mx-auto px-3 sm:px-4 md:px-6', isEmpty ? 'py-8 md:py-16' : 'py-4 sm:py-6 space-y-4 sm:space-y-6')}>
          {/* Welcome Hero */}
          {isEmpty && (
            <div className="flex flex-col items-center text-center pt-4 sm:pt-8 md:pt-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary mb-4 sm:mb-5 shadow-sm">
                <LuBot className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-[28px] font-semibold text-foreground tracking-tight mb-2">
                با چه کاری می‌توانم کمکتان کنم؟
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md leading-relaxed mb-6 sm:mb-8 px-2">
                سوال خود را درباره استقرار، دیباگ لاگ‌ها یا تنظیمات سرویس‌های لیارا بپرسید.
              </p>

              <div className="grid w-full max-w-xl grid-cols-1 gap-2 px-1 sm:grid-cols-2 sm:gap-2.5">
                {samplePrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => onSendMessage(p.prompt)}
                    className="text-right p-3 sm:p-3.5 rounded-2xl bg-card border border-border hover:bg-muted/60 hover:border-primary/40 text-xs sm:text-sm transition-colors duration-150 flex items-center justify-between gap-2 group shadow-sm"
                  >
                    <span className="font-medium text-foreground">{p.title}</span>
                    <LuArrowLeft className="w-4 h-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Thread */}
          {messages.map((msg, idx) =>
            msg.role === 'user' ? (
              <div key={idx} className="flex w-full justify-end" dir="ltr">
                <div dir="rtl" className="max-w-[96%] sm:max-w-[92%] md:max-w-[88%] rounded-3xl bg-secondary text-secondary-foreground px-3.5 py-2 sm:px-4 sm:py-2.5 text-right">
                  <p className="whitespace-pre-wrap text-sm sm:text-[15px] leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ) : (
              <div key={idx} className="group/msg flex w-full items-start justify-start gap-2.5 sm:gap-3" dir="ltr">
                <div className="w-7 h-7 mt-0.5 rounded-lg bg-primary/10 border border-primary/15 shrink-0 flex items-center justify-center text-primary">
                  <LuBot className="w-4 h-4" />
                </div>

                <div className="min-w-0 max-w-[calc(96%-2.5rem)] sm:max-w-[calc(92%-2.5rem)] md:max-w-[calc(88%-2.5rem)] rounded-3xl border border-border/70 bg-card px-3.5 py-2 sm:px-4 sm:py-2.5 elevation-1" dir="rtl">
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
            <div className="flex w-full items-start justify-start gap-3" dir="ltr">
              <div className="w-7 h-7 mt-0.5 rounded-lg bg-primary/10 border border-primary/15 shrink-0 flex items-center justify-center text-primary">
                <LuBot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0 max-w-[calc(96%-2.5rem)] sm:max-w-[calc(92%-2.5rem)] md:max-w-[calc(88%-2.5rem)] rounded-3xl border border-border/70 bg-card px-3.5 py-2 sm:px-4 sm:py-2.5 elevation-1" dir="rtl">
                {streamingBuffer ? (
                  <div
                    className="markdown-body text-[15px] text-foreground"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(streamingBuffer),
                    }}
                  />
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-2" role="status" aria-live="polite" aria-busy="true">
                    <span className="sr-only">دستیار در حال نوشتن پاسخ است</span>
                    <span className="assistant-scan" aria-hidden="true" />
                    <span className="text-xs font-medium text-primary">در حال تحلیل درخواست…</span>
                  </div>
                )}
                {streamingBuffer && (
                  <span className="inline-block w-2 h-4 bg-primary/80 animate-pulse rounded-sm align-middle mr-0.5" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {composer}
    </div>
  )
}
