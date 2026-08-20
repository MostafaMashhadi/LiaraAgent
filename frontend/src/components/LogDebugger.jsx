import React, { useState } from 'react';
import { Bug, Sparkles, AlertCircle, CheckCircle2, Terminal, Copy, Check, RefreshCw } from 'lucide-react';
import { marked } from 'marked';

export default function LogDebugger() {
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
    }
  ];

  const handleAnalyze = async () => {
    if (!logInput.trim() || isLoading) return;
    setIsLoading(true);
    setDiagnosisResult(null);

    try {
      const res = await fetch('/api/tools/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: logInput.trim() })
      });

      if (!res.ok) {
        throw new Error('خطا در ارتباط با سرویس دیباگر');
      }

      const data = await res.json();
      setDiagnosisResult(data);
    } catch (err) {
      setDiagnosisResult({
        success: false,
        error: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-y-auto p-4 md:p-6">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2e2e2e]">
          <div>
            <div className="flex items-center gap-2.5">
              <Bug className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-bold text-white">دیباگر و ریشه‌یاب خطاهای دیپلوی (Log Inspector)</h2>
            </div>
            <p className="text-xs text-[#a0aec0] mt-1">
              تحلیل لاگ‌های خطا، Stack Trace برنامه‌ها و عیب‌یابی آنی با هوش مصنوعی و الگوهای اختصاصی لیارا
            </p>
          </div>
        </div>

        {/* Presets */}
        <div>
          <p className="text-[11px] font-semibold text-[#a0aec0] mb-2">نمونه خطاهای پرتکرار جهت تست سریع:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => setLogInput(p.log)}
                className="text-right p-2.5 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#333333] hover:border-[#0076ff]/40 text-xs text-[#e2e8f0] transition text-ellipsis overflow-hidden"
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>

        {/* Log Input Area */}
        <div className="liara-card p-4 space-y-3">
          <label className="text-xs font-semibold text-[#cbd5e1] block">
            متن لاگ یا خطای ترمینال را در این قسمت قرار دهید:
          </label>
          <textarea
            rows={7}
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            placeholder="Log traceback or deployment output here..."
            className="w-full bg-[#141414] border border-[#333333] focus:border-[#0076ff] text-[#e2e8f0] text-xs font-mono rounded-xl p-3.5 outline-none resize-y"
          />

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => { setLogInput(''); setDiagnosisResult(null); }}
              className="text-xs text-[#718096] hover:text-white transition flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>پاک کردن</span>
            </button>

            <button
              onClick={handleAnalyze}
              disabled={!logInput.trim() || isLoading}
              className="bg-[#0076ff] hover:bg-[#0062d6] disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'در حال تحلیل عمیق لاگ...' : 'تحلیل و ریشه‌یابی خطا'}</span>
            </button>
          </div>
        </div>

        {/* Diagnosis Results Display */}
        {diagnosisResult && (
          <div className="liara-card p-5 border border-[#38bdf8]/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#333333]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">نتیجه تحلیل تخصصی و راهکار رفع مشکل</h3>
              </div>
              <button
                onClick={() => handleCopy(diagnosisResult.data || '')}
                className="text-xs bg-[#2a2a2a] hover:bg-[#333333] border border-[#3e3e3e] text-[#eeeeee] px-2.5 py-1 rounded-lg transition flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'کپی شد' : 'کپی تحلیل'}</span>
              </button>
            </div>

            {diagnosisResult.data ? (
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: marked.parse(diagnosisResult.data) }}
              />
            ) : (
              <div className="text-rose-400 text-xs">
                خطایی رخ داد: {diagnosisResult.error || 'پاسخی دریافت نشد'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
