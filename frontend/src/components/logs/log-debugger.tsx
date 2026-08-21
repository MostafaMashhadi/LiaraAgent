import React, { useState } from 'react';
import { LuBug, LuSparkles, LuCircleAlert, LuCircleCheck, LuTerminal, LuCopy, LuCheck, LuRefreshCw } from 'react-icons/lu';
import { marked } from 'marked';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LogDebuggerProps {
  authToken?: string;
}

export default function LogDebugger({}: LogDebuggerProps) {
  const [logInput, setLogInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const presets = [
    {
      title: 'خطای 502 Bad Gateway (عدم پاسخ پورت)',
      log: `2026/08/20 10:20:00 [error] 12#12: *1 connect() failed (111: Connection refused) while connecting to upstream, client: 172.18.0.1, server: _, request: "GET / HTTP/1.1", upstream: "http://127.0.0.1:3000/", host: "my-app.liara.run"`,
    },
    {
      title: 'خطای کمبود حافظه (JavaScript heap out of memory)',
      log: `<--- Last few GCs --->\n[1:0x55555678] 45120 ms: Mark-sweep 1024.5 (1050.2) -> 1024.1 (1050.2) MB, 120.4 / 0.0 ms\n\n<--- JS stacktrace --->\nFATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`,
    },
    {
      title: 'خطای اتصال دیتابیس (ECONNREFUSED PostgreSQL)',
      log: `Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1494:16)\n    at Protocol.handshake (/app/node_modules/pg/lib/connection.js:140:12)`,
    },
    {
      title: 'خطای عدم وجود اسکریپت Start (npm ERR! missing script)',
      log: `npm ERR! Missing script: "start"\nnpm ERR! To see a list of scripts, run:\nnpm ERR!   npm run\n\nnpm ERR! A complete log of this run can be found in:\nnpm ERR!     /root/.npm/_logs/2026-08-20T10_00_00_000Z-debug.log`,
    },
  ];

  const handleAnalyze = async () => {
    if (!logInput.trim() || isLoading) return;
    setIsLoading(true);
    setDiagnosisResult(null);

    try {
      const res = await fetch('/api/tools/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: logInput.trim() }),
      });

      if (!res.ok) {
        throw new Error('خطا در ارتباط با سرویس دیباگر');
      }

      const data = await res.json();
      setDiagnosisResult(data);
    } catch (err) {
      setDiagnosisResult({
        success: false,
        error: err instanceof Error ? err.message : 'خطای ناشناخته',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
                <LuBug className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground">دیباگر و ریشه‌یاب خطاهای دیپلوی (Log Inspector)</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              تحلیل لاگ‌های خطا، Stack Trace برنامه‌ها و عیب‌یابی آنی با هوش مصنوعی و الگوهای اختصاصی لیارا
            </p>
          </div>
        </div>

        {/* Presets */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-2">نمونه خطاهای پرتکرار جهت تست سریع:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => setLogInput(p.log)}
                className="text-right p-3 rounded-xl bg-card border border-border hover:border-primary/50 text-sm text-foreground transition-all duration-200 elevation-1 hover:elevation-2"
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>

        {/* Log Input Area */}
        <Card className="p-4 space-y-3 elevation-1">
          <label className="text-xs font-semibold text-foreground block">
            متن لاگ یا خطای ترمینال را در این قسمت قرار دهید:
          </label>
          <Textarea
            rows={7}
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            placeholder="Log traceback or deployment output here..."
            className="font-mono text-xs resize-y"
          />

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setLogInput(''); setDiagnosisResult(null); }}
            >
              <LuRefreshCw className="w-3.5 h-3.5" />
              <span>پاک کردن</span>
            </Button>

            <Button
              variant="teal"
              size="sm"
              onClick={handleAnalyze}
              disabled={!logInput.trim() || isLoading}
              className="shadow-teal-glow"
            >
              <LuSparkles className="w-4 h-4" />
              <span>{isLoading ? 'در حال تحلیل عمیق لاگ...' : 'تحلیل و ریشه‌یابی خطا'}</span>
            </Button>
          </div>
        </Card>

        {/* Diagnosis Results Display */}
        {diagnosisResult && (
          <Card className="p-5 border border-primary/30 space-y-4 elevation-2 animate-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <LuCircleCheck className="w-5 h-5 text-mint" />
                <h3 className="text-sm font-bold text-foreground">نتیجه تحلیل تخصصی و راهکار رفع مشکل</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(diagnosisResult.data || '')}
              >
                {copied ? <LuCheck className="w-3.5 h-3.5 text-mint" /> : <LuCopy className="w-3.5 h-3.5" />}
                <span>{copied ? 'کپی شد' : 'کپی تحلیل'}</span>
              </Button>
            </div>

            {diagnosisResult.data ? (
              <div
                className="markdown-body text-sm"
                dangerouslySetInnerHTML={{ __html: marked.parse(diagnosisResult.data) }}
              />
            ) : (
              <div className="text-destructive text-xs">
                خطایی رخ داد: {diagnosisResult.error || 'پاسخی دریافت نشد'}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

