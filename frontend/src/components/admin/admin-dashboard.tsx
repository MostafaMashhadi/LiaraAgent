import React, { useState, useEffect } from 'react';
import { LuShield, LuRefreshCw, LuTerminal, LuX, LuSliders, LuDollarSign, LuSave, LuCheck, LuSparkles, LuCircleHelp, LuCoins } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface AdminDashboardProps {
  authToken: string;
}

export default function AdminDashboard({ authToken }: AdminDashboardProps) {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

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

  const getTemperatureLabel = (val) => {
    if (val <= 0.15) return 'بسیار دقیق و متمرکز بر مستندات (بدون خلاقیت)';
    if (val <= 0.35) return 'متعادل و فنی (پیش‌فرض پیشنهادی لیارا)';
    if (val <= 0.65) return 'توضیحی و منعطف با مثال‌های بیشتر';
    return 'بسیار خلاقانه و گسترده';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <LuShield className="w-5 h-5 text-mint" />
              <span>پنل مدیریت سیستم و مانیتورینگ مصرف هوش مصنوعی</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              تنظیمات پارامترهای AI، ضرایب قیمت‌گذاری توکن‌ها، لاگ‌های PostgreSQL و نرخ هزینه
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
          >
            <LuRefreshCw className="w-3.5 h-3.5" />
            <span>بروزرسانی داده‌ها</span>
          </Button>
        </div>

        {/* Summary Stat Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <Card className="p-4 space-y-1 elevation-1">
              <span className="text-[11px] text-muted-foreground">مجموع توکن‌های مصرفی</span>
              <div className="text-lg font-bold text-foreground font-mono">
                {stats.total_tokens.toLocaleString()}
              </div>
              <span className="text-[10px] text-mint">کل ورودی و خروجی</span>
            </Card>

            <Card className="p-4 space-y-1 elevation-1">
              <span className="text-[11px] text-muted-foreground">توکن‌های ورودی (Prompt)</span>
              <div className="text-lg font-bold text-primary font-mono">
                {stats.total_prompt_tokens.toLocaleString()}
              </div>
              <span className="text-[10px] text-muted-foreground">Context & Docs</span>
            </Card>

            <Card className="p-4 space-y-1 elevation-1">
              <span className="text-[11px] text-muted-foreground">توکن‌های خروجی (Gen)</span>
              <div className="text-lg font-bold text-gold font-mono">
                {stats.total_completion_tokens.toLocaleString()}
              </div>
              <span className="text-[10px] text-muted-foreground">پاسخ‌های مدل</span>
            </Card>

            <Card className="p-4 space-y-1 elevation-1">
              <span className="text-[11px] text-muted-foreground">هزینه کل (دلار)</span>
              <div className="text-lg font-bold text-mint font-mono">
                ${stats.estimated_cost_usd ? stats.estimated_cost_usd.toFixed(4) : '0.0000'}
              </div>
              <span className="text-[10px] text-muted-foreground">بر اساس نرخ تنظیمی</span>
            </Card>

            <Card className="p-4 space-y-1 elevation-1">
              <span className="text-[11px] text-muted-foreground">هزینه کل (تومان)</span>
              <div className="text-lg font-bold text-teal-500 font-mono">
                {stats.estimated_cost_toman ? Math.round(stats.estimated_cost_toman).toLocaleString() : '۰'} <span className="text-xs font-sans">تومان</span>
              </div>
              <span className="text-[10px] text-muted-foreground">دلار {usdToTomanRate.toLocaleString()} ت</span>
            </Card>
          </div>
        )}

        {/* Settings & Logs Tabs */}
        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList className="bg-muted/50 border border-border">
            <TabsTrigger value="settings" className="gap-2">
              <LuSlidersHorizontal className="w-4 h-4" />
              <span>تنظیمات AI و قیمت‌گذاری</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <LuTerminal className="w-4 h-4" />
              <span>لاگ‌های درخواست ({totalLogs})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <Card className="p-5 space-y-5 border border-border elevation-1">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <LuSlidersHorizontal className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">پیکربندی هوش مصنوعی و ضرایب هزینه (per 1 Million Tokens)</h3>
                </div>
                <Button
                  variant="teal"
                  size="sm"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="shadow-teal-glow"
                >
                  {settingsSaved ? <LuCheck className="w-3.5 h-3.5 text-white" /> : <LuSave className="w-3.5 h-3.5" />}
                  <span>{settingsSaved ? 'ذخیره شد' : 'ذخیره تنظیمات'}</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* 1. AI Creativity */}
                <div className="lg:col-span-6 space-y-3 bg-muted/30 p-4 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <LuSparkles className="w-4 h-4 text-gold" />
                      <span>میزان خلاقیت هوش مصنوعی (Temperature)</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-primary bg-background px-2 py-0.5 rounded border border-border">
                      {parseFloat(temperature).toFixed(2)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-2 bg-input rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground select-none font-mono">
                      <span>0.0 (دقیق)</span>
                      <span>0.5 (متعادل)</span>
                      <span>1.0 (خلاق)</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground bg-muted/50 p-2.5 rounded-lg border border-border">
                    وضعیت: <b className="text-teal-500">{getTemperatureLabel(temperature)}</b>
                  </p>
                </div>

                {/* 2. Token Pricing */}
                <div className="lg:col-span-6 space-y-3 bg-muted/30 p-4 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <LuCoins className="w-4 h-4 text-mint" />
                      <span>ضرایب هزینه به ازای هر ۱ میلیون توکن (USD)</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] select-none">
                    <span className="text-muted-foreground">پریست‌ها:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyPreset(0.150, 0.600)}
                      className="h-6 text-[10px]"
                    >
                      AvalAI / GPT-4o mini
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyPreset(0.075, 0.300)}
                      className="h-6 text-[10px]"
                    >
                      AvalAI / Gemini Flash
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyPreset(0.550, 2.190)}
                      className="h-6 text-[10px]"
                    >
                      AvalAI / DeepSeek R1
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyPreset(3.000, 15.000)}
                      className="h-6 text-[10px]"
                    >
                      Claude 3.5 Sonnet
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground block">ورودی (1M Prompt)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-mono text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.001"
                          value={inputCostPerM}
                          onChange={(e) => setInputCostPerM(parseFloat(e.target.value) || 0)}
                          className="pl-6 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground block">خروجی (1M Output)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-mono text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.001"
                          value={outputCostPerM}
                          onChange={(e) => setOutputCostPerM(parseFloat(e.target.value) || 0)}
                          className="pl-6 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground block">نرخ دلار (تومان)</label>
                      <Input
                        type="number"
                        step="1000"
                        value={usdToTomanRate}
                        onChange={(e) => setUsdToTomanRate(parseFloat(e.target.value) || 90000)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card className="overflow-hidden elevation-1">
              <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <LuTerminal className="w-4 h-4 text-primary" />
                  <span>جدول تاریخچه لاگ‌های درخواست AI ({totalLogs} رکورد)</span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border text-[11px]">
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
                  <tbody className="divide-y divide-border text-foreground">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-3 text-[11px] text-muted-foreground font-mono">
                          {new Date(log.created_at).toLocaleTimeString('fa-IR')}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-foreground block">{log.user_email || 'guest'}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{log.session_id}</span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-primary">{log.endpoint}</td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">{log.model}</td>
                        <td className="p-3 text-center font-mono text-primary">{log.prompt_tokens}</td>
                        <td className="p-3 text-center font-mono text-gold">{log.completion_tokens}</td>
                        <td className="p-3 text-center font-mono font-bold text-mint">{log.total_tokens}</td>
                        <td className="p-3 text-center font-mono text-muted-foreground">{log.duration_ms}ms</td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="h-7 text-xs"
                          >
                            مشاهده
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Log Details Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full p-6 space-y-4 bg-card border border-border elevation-5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-sm font-bold text-foreground font-mono">
                  جزئیات تراکنش {selectedLog.id}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)}>
                  <LuX className="w-5 h-5" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono bg-muted/50 p-3 rounded-xl border border-border">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Prompt Tokens:</span>
                  <b className="text-primary">{selectedLog.prompt_tokens}</b>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Gen Tokens:</span>
                  <b className="text-gold">{selectedLog.completion_tokens}</b>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Total:</span>
                  <b className="text-mint">{selectedLog.total_tokens}</b>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">پرامپت ورودی (Prompt):</label>
                <div className="p-3 bg-muted/30 rounded-xl border border-border text-xs font-mono text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto" dir="auto">
                  {selectedLog.prompt}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">پاسخ تولید شده (Response):</label>
                <div className="p-3 bg-muted/30 rounded-xl border border-border text-xs font-mono text-primary whitespace-pre-wrap max-h-48 overflow-y-auto" dir="auto">
                  {selectedLog.response}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

