import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  RefreshCw, 
  Terminal, 
  X, 
  Sliders, 
  DollarSign, 
  Save, 
  Check, 
  Sparkles, 
  HelpCircle,
  Coins
} from 'lucide-react';

export default function AdminDashboard({ authToken }) {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // Dynamic AI & Pricing Settings
  const [temperature, setTemperature] = useState(0.3);
  const [inputCostPerM, setInputCostPerM] = useState(0.150);
  const [outputCostPerM, setOutputCostPerM] = useState(0.600);
  const [usdToTomanRate, setUsdToTomanRate] = useState(90000);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, logsRes, settingsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/admin/logs?limit=50', { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
        setTotalLogs(data.total || 0);
      }
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        if (s.temperature !== undefined) setTemperature(s.temperature);
        if (s.input_cost_per_m !== undefined) setInputCostPerM(s.input_cost_per_m);
        if (s.output_cost_per_m !== undefined) setOutputCostPerM(s.output_cost_per_m);
        if (s.usd_to_toman_rate !== undefined) setUsdToTomanRate(s.usd_to_toman_rate);
      }
    } catch (e) {
      console.error('Failed to fetch admin metrics', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authToken]);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          temperature: parseFloat(temperature),
          input_cost_per_m: parseFloat(inputCostPerM),
          output_cost_per_m: parseFloat(outputCostPerM),
          usd_to_toman_rate: parseFloat(usdToTomanRate),
        }),
      });
      if (res.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
        // Refresh stats to reflect new cost calculation
        const statsRes = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${authToken}` } });
        if (statsRes.ok) setStats(await statsRes.json());
      }
    } catch (e) {
      console.error('Failed to save settings', e);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const applyPreset = (inputCost, outputCost) => {
    setInputCostPerM(inputCost);
    setOutputCostPerM(outputCost);
  };

  // Label for temperature creativity level
  const getTemperatureLabel = (val) => {
    if (val <= 0.15) return 'بسیار دقیق و متمرکز بر مستندات (بدون خلاقیت)';
    if (val <= 0.35) return 'متعادل و فنی (پیش‌فرض پیشنهادی لیارا)';
    if (val <= 0.65) return 'توضیحی و منعطف با مثال‌های بیشتر';
    return 'بسیار خلاقانه و گسترده';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#181818] space-y-6">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#ffffff15] gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>پنل مدیریت سیستم و مانیتورینگ مصرف هوش مصنوعی</span>
            </h2>
            <p className="text-xs text-[#a0acb7] mt-1">
              تنظیمات پارامترهای AI، ضرایب قیمت‌گذاری توکن‌ها، لاگ‌های PostgreSQL و نرخ هزینه
            </p>
          </div>
          <button
            onClick={fetchData}
            className="liara-btn-ghost px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>بروزرسانی داده‌ها</span>
          </button>
        </div>

        {/* Summary Stat Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="liara-card p-4 space-y-1">
              <span className="text-[11px] text-[#a0acb7]">مجموع توکن‌های مصرفی</span>
              <div className="text-lg font-bold text-white font-mono">
                {stats.total_tokens.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-400">کل ورودی و خروجی</span>
            </div>

            <div className="liara-card p-4 space-y-1">
              <span className="text-[11px] text-[#a0acb7]">توکن‌های ورودی (Prompt)</span>
              <div className="text-lg font-bold text-[#38bdf8] font-mono">
                {stats.total_prompt_tokens.toLocaleString()}
              </div>
              <span className="text-[10px] text-[#a0acb7]">Context & Docs</span>
            </div>

            <div className="liara-card p-4 space-y-1">
              <span className="text-[11px] text-[#a0acb7]">توکن‌های خروجی (Gen)</span>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {stats.total_completion_tokens.toLocaleString()}
              </div>
              <span className="text-[10px] text-[#a0acb7]">پاسخ‌های مدل</span>
            </div>

            <div className="liara-card p-4 space-y-1">
              <span className="text-[11px] text-[#a0acb7]">هزینه کل (دلار)</span>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                ${stats.estimated_cost_usd ? stats.estimated_cost_usd.toFixed(4) : '0.0000'}
              </div>
              <span className="text-[10px] text-[#7a8a94]">بر اساس نرخ تنظیمی</span>
            </div>

            <div className="liara-card p-4 space-y-1">
              <span className="text-[11px] text-[#a0acb7]">هزینه کل (تومان)</span>
              <div className="text-lg font-bold text-[#87fcc4] font-mono">
                {stats.estimated_cost_toman ? Math.round(stats.estimated_cost_toman).toLocaleString() : '۰'} <span className="text-xs font-sans">تومان</span>
              </div>
              <span className="text-[10px] text-[#7a8a94]">دلار {usdToTomanRate.toLocaleString()} ت</span>
            </div>
          </div>
        )}

        {/* AI Creativity & Pricing Configuration Card */}
        <div className="liara-card p-5 space-y-5 border border-[#ffffff15] bg-[#1e1e22]">
          <div className="flex items-center justify-between pb-3 border-b border-[#ffffff15]">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#38bdf8]" />
              <h3 className="text-sm font-bold text-white">پیکربندی هوش مصنوعی و ضرایب هزینه (per 1 Million Tokens)</h3>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="liara-btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {settingsSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
              <span>{settingsSaved ? 'ذخیره شد' : 'ذخیره تنظیمات'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 1. AI Creativity (Temperature) */}
            <div className="lg:col-span-6 space-y-3 bg-[#181818] p-4 rounded-xl border border-[#ffffff10]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>میزان خلاقیت هوش مصنوعی (Temperature)</span>
                </label>
                <span className="text-xs font-mono font-bold text-[#38bdf8] bg-[#222222] px-2 py-0.5 rounded border border-[#ffffff15]">
                  {parseFloat(temperature).toFixed(2)}
                </span>
              </div>

              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#0076ff]"
              />

              <div className="flex justify-between text-[10px] text-[#7a8a94] select-none font-mono">
                <span>0.0 (دقیق/رسمی)</span>
                <span>0.5 (متعادل)</span>
                <span>1.0 (خلاق)</span>
              </div>

              <p className="text-[11px] text-[#a0acb7] bg-[#121214] p-2.5 rounded-lg border border-[#ffffff08]">
                وضعیت: <b className="text-[#87fcc4]">{getTemperatureLabel(temperature)}</b>
              </p>
            </div>

            {/* 2. Token Pricing Multipliers */}
            <div className="lg:col-span-6 space-y-3 bg-[#181818] p-4 rounded-xl border border-[#ffffff10]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>ضرایب هزینه به ازای هر ۱ میلیون توکن (USD)</span>
                </label>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] select-none">
                <span className="text-[#7a8a94]">پریست‌ها:</span>
                <button
                  onClick={() => applyPreset(0.150, 0.600)}
                  className="bg-[#262626] hover:bg-[#333333] text-[#a0acb7] hover:text-white px-2 py-0.5 rounded transition border border-[#ffffff10] whitespace-nowrap"
                >
                  AvalAI / GPT-4o mini ($0.15/$0.60)
                </button>
                <button
                  onClick={() => applyPreset(0.075, 0.300)}
                  className="bg-[#262626] hover:bg-[#333333] text-[#a0acb7] hover:text-white px-2 py-0.5 rounded transition border border-[#ffffff10] whitespace-nowrap"
                >
                  AvalAI / Gemini Flash ($0.075/$0.30)
                </button>
                <button
                  onClick={() => applyPreset(0.550, 2.190)}
                  className="bg-[#262626] hover:bg-[#333333] text-[#a0acb7] hover:text-white px-2 py-0.5 rounded transition border border-[#ffffff10] whitespace-nowrap"
                >
                  AvalAI / DeepSeek R1 ($0.55/$2.19)
                </button>
                <button
                  onClick={() => applyPreset(3.000, 15.000)}
                  className="bg-[#262626] hover:bg-[#333333] text-[#a0acb7] hover:text-white px-2 py-0.5 rounded transition border border-[#ffffff10] whitespace-nowrap"
                >
                  AvalAI / Claude 3.5 Sonnet ($3.0/$15.0)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="text-[10px] text-[#a0acb7] block mb-1">ورودی (1M Prompt)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-mono text-[#7a8a94]">$</span>
                    <input
                      type="number"
                      step="0.001"
                      value={inputCostPerM}
                      onChange={(e) => setInputCostPerM(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#121214] border border-[#333333] focus:border-[#0076ff] text-xs rounded-lg py-2 pl-6 pr-2 text-white font-mono outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#a0acb7] block mb-1">خروجی (1M Output)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-mono text-[#7a8a94]">$</span>
                    <input
                      type="number"
                      step="0.001"
                      value={outputCostPerM}
                      onChange={(e) => setOutputCostPerM(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#121214] border border-[#333333] focus:border-[#0076ff] text-xs rounded-lg py-2 pl-6 pr-2 text-white font-mono outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#a0acb7] block mb-1">نرخ دلار (تومان)</label>
                  <input
                    type="number"
                    step="1000"
                    value={usdToTomanRate}
                    onChange={(e) => setUsdToTomanRate(parseFloat(e.target.value) || 90000)}
                    className="w-full bg-[#121214] border border-[#333333] focus:border-[#0076ff] text-xs rounded-lg py-2 px-2.5 text-white font-mono outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Request Logs Table */}
        <div className="liara-card overflow-hidden">
          <div className="p-4 bg-[#222222] border-b border-[#ffffff15] flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#38bdf8]" />
              <span>جدول تاریخچه لاگ‌های درخواست AI ({totalLogs} رکورد)</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#181818] text-[#a0acb7] border-b border-[#ffffff15] text-[11px]">
                <tr>
                  <th className="p-3">زمان</th>
                  <th className="p-3">کاربر / سشن</th>
                  <th className="p-3">اندپوینت</th>
                  <th className="p-3">مدل</th>
                  <th className="p-3 text-center">توکن ورودی</th>
                  <th className="p-3 text-center">توکن خروجی</th>
                  <th className="p-3 text-center">مجموع توکن</th>
                  <th className="p-3 text-center">تاخیر (ms)</th>
                  <th className="p-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ffffff10] text-[#eeeeee]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#282828] transition">
                    <td className="p-3 text-[11px] text-[#a0acb7] font-mono">
                      {new Date(log.created_at).toLocaleTimeString('fa-IR')}
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-white block">{log.user_email || 'guest'}</span>
                      <span className="text-[10px] text-[#7a8a94] font-mono">{log.session_id}</span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-[#38bdf8]">{log.endpoint}</td>
                    <td className="p-3 font-mono text-[11px] text-[#a0acb7]">{log.model}</td>
                    <td className="p-3 text-center font-mono text-[#38bdf8]">{log.prompt_tokens}</td>
                    <td className="p-3 text-center font-mono text-amber-400">{log.completion_tokens}</td>
                    <td className="p-3 text-center font-mono font-bold text-emerald-400">{log.total_tokens}</td>
                    <td className="p-3 text-center font-mono text-[#a0acb7]">{log.duration_ms}ms</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="liara-btn-ghost px-2.5 py-1 rounded text-[10px] hover:text-white"
                      >
                        مشاهده
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Log Details Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="liara-card max-w-2xl w-full p-6 space-y-4 bg-[#222222] border border-[#ffffff20] max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#ffffff15]">
                <h3 className="text-sm font-bold text-white font-mono">
                  جزئیات تراکنش {selectedLog.id}
                </h3>
                <button onClick={() => setSelectedLog(null)} className="text-[#a0acb7] hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-[#181818] p-3 rounded-xl border border-[#ffffff15]">
                <div>
                  <span className="text-[#a0acb7] block text-[10px]">Prompt Tokens:</span>
                  <b className="text-[#38bdf8]">{selectedLog.prompt_tokens}</b>
                </div>
                <div>
                  <span className="text-[#a0acb7] block text-[10px]">Gen Tokens:</span>
                  <b className="text-amber-400">{selectedLog.completion_tokens}</b>
                </div>
                <div>
                  <span className="text-[#a0acb7] block text-[10px]">Total:</span>
                  <b className="text-emerald-400">{selectedLog.total_tokens}</b>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#a0acb7]">پرامپت ورودی (Prompt):</label>
                <div className="p-3 bg-[#121212] rounded-xl border border-[#333333] text-xs font-mono text-white whitespace-pre-wrap max-h-40 overflow-y-auto" dir="auto">
                  {selectedLog.prompt}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#a0acb7]">پاسخ تولید شده (Response):</label>
                <div className="p-3 bg-[#121212] rounded-xl border border-[#333333] text-xs font-mono text-[#38bdf8] whitespace-pre-wrap max-h-48 overflow-y-auto" dir="auto">
                  {selectedLog.response}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
