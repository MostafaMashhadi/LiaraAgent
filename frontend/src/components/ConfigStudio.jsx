import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, 
  Download, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Code2, 
  FileCode, 
  CheckCircle2,
  Terminal,
  RotateCcw,
  Sparkles,
  Command
} from 'lucide-react';

export default function ConfigStudio() {
  const [platform, setPlatform] = useState('node');
  const [appName, setAppName] = useState('my-app');
  const [port, setPort] = useState('3000');
  const [healthCheck, setHealthCheck] = useState('/healthz');
  const [cronExpression, setCronExpression] = useState('');
  const [cronCommand, setCronCommand] = useState('');
  const [disks, setDisks] = useState([
    { name: 'app-data', mountTo: '/app/storage' }
  ]);
  const [envs, setEnvs] = useState([
    { key: 'NODE_ENV', value: 'production' }
  ]);
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState('json'); // 'json' | 'docker'

  // Code editor states
  const [editorMode, setEditorMode] = useState('normal'); // 'normal' | 'vim'
  const [vimState, setVimState] = useState('NORMAL'); // 'NORMAL' | 'INSERT' | 'COMMAND'
  const [vimCommand, setVimCommand] = useState('');
  const [vimStatusMsg, setVimStatusMsg] = useState('حالت نرمال - برای ویرایش کلید i را بزنید');
  const [jsonCode, setJsonCode] = useState('');
  const [dockerCode, setDockerCode] = useState('');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [clipboardBuffer, setClipboardBuffer] = useState('');
  const [historyStack, setHistoryStack] = useState([]);
  const [isManualEdit, setIsManualEdit] = useState(false);

  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const lastKeyRef = useRef('');

  const platforms = [
    { id: 'node', label: 'Node.js', defaultPort: '3000' },
    { id: 'next', label: 'Next.js', defaultPort: '3000' },
    { id: 'laravel', label: 'Laravel', defaultPort: '80' },
    { id: 'django', label: 'Django', defaultPort: '80' },
    { id: 'fastapi', label: 'FastAPI', defaultPort: '8000' },
    { id: 'go', label: 'Go (Golang)', defaultPort: '8080' },
    { id: 'docker', label: 'Docker', defaultPort: '8080' },
    { id: 'static', label: 'Static', defaultPort: '80' },
  ];

  const handlePlatformChange = (pId) => {
    setPlatform(pId);
    const target = platforms.find(p => p.id === pId);
    if (target) {
      setPort(target.defaultPort);
      if (pId === 'laravel') {
        setDisks([{ name: 'storage-disk', mountTo: 'storage' }]);
        setEnvs([
          { key: 'APP_ENV', value: 'production' },
          { key: 'APP_DEBUG', value: 'false' },
        ]);
      } else if (pId === 'django') {
        setDisks([{ name: 'media-disk', mountTo: 'media' }]);
        setEnvs([{ key: 'DJANGO_SETTINGS_MODULE', value: 'myproject.settings' }]);
      } else if (pId === 'go') {
        setDisks([]);
        setEnvs([{ key: 'GIN_MODE', value: 'release' }]);
      }
    }
    setIsManualEdit(false);
  };

  const addDisk = () => {
    setDisks([...disks, { name: 'new-disk', mountTo: '/app/data' }]);
    setIsManualEdit(false);
  };
  const removeDisk = (index) => {
    setDisks(disks.filter((_, i) => i !== index));
    setIsManualEdit(false);
  };

  // Build liara.json object
  const buildConfigObject = () => {
    const config = {
      app: appName || 'my-app',
      platform: platform,
      port: parseInt(port, 10) || 3000,
    };

    if (healthCheck) {
      config.healthCheck = {
        path: healthCheck,
      };
    }

    if (disks.length > 0) {
      config.disks = disks.map(d => ({
        name: d.name,
        mountTo: d.mountTo,
      }));
    }

    if (cronExpression && cronCommand) {
      config.cron = [
        `${cronExpression} ${cronCommand}`
      ];
    }

    return config;
  };

  // Build Dockerfile template if needed
  const buildDockerfile = () => {
    if (platform === 'node' || platform === 'next') {
      return `FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nENV PORT=${port}\nCOPY --from=builder /app ./\nEXPOSE ${port}\nCMD ["npm", "start"]`;
    }
    if (platform === 'go') {
      return `FROM golang:1.23-alpine AS builder\nWORKDIR /app\nCOPY go.* ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -o main .\n\nFROM alpine:latest\nWORKDIR /app\nCOPY --from=builder /app/main .\nEXPOSE ${port}\nCMD ["./main"]`;
    }
    if (platform === 'django' || platform === 'fastapi') {
      return `FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE ${port}\nCMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:${port}"]`;
    }
    return `FROM alpine:latest\nWORKDIR /app\nCOPY . .\nEXPOSE ${port}\nCMD ["echo", "Ready"]`;
  };

  // Auto-generate code when form changes (unless manually edited)
  useEffect(() => {
    if (!isManualEdit) {
      setJsonCode(JSON.stringify(buildConfigObject(), null, 2));
      setDockerCode(buildDockerfile());
    }
  }, [platform, appName, port, healthCheck, disks, cronExpression, cronCommand, isManualEdit]);

  const currentCode = activeView === 'json' ? jsonCode : dockerCode;

  const setCurrentCode = (newCode) => {
    // push to history
    setHistoryStack(prev => [...prev.slice(-30), currentCode]);
    setIsManualEdit(true);
    if (activeView === 'json') {
      setJsonCode(newCode);
    } else {
      setDockerCode(newCode);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = activeView === 'json' ? 'liara.json' : 'Dockerfile';
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setVimStatusMsg(`"${filename}" با موفقیت ذخیره و دانلود شد`);
  };

  const handleFormatJson = () => {
    if (activeView === 'json') {
      try {
        const parsed = JSON.parse(jsonCode);
        setCurrentCode(JSON.stringify(parsed, null, 2));
        setVimStatusMsg('JSON با موفقیت فرمت‌بندی شد');
      } catch (err) {
        setVimStatusMsg('خطا در فرمت: فرمت JSON نامعتبر است');
      }
    }
  };

  const handleResetFromForm = () => {
    setIsManualEdit(false);
    setJsonCode(JSON.stringify(buildConfigObject(), null, 2));
    setDockerCode(buildDockerfile());
    setVimStatusMsg('کد مجدداً از مشخصات فرم همگام‌سازی شد');
  };

  // Update cursor position tracking
  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const { selectionStart, value } = textareaRef.current;
    const textUpToCursor = value.substring(0, selectionStart);
    const lines = textUpToCursor.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    setCursorPos({ line, col });
  };

  // Sync scrolling between line numbers and textarea
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Keyboard handler for Tab, Esc, and Vim Shortcuts
  const handleKeyDown = (e) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;

    // Normal Mode or Insert Mode Tab Key
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = selectionStart;
      const end = selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      setCurrentCode(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateCursorPosition();
      }, 0);
      return;
    }

    // Ctrl+S: Quick Save / Download
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleDownload();
      return;
    }

    // Vim Mode Keyboard Logic
    if (editorMode === 'vim') {
      if (vimState === 'INSERT') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setVimState('NORMAL');
          setVimStatusMsg('-- NORMAL --');
          textarea.blur();
          return;
        }
        // Let standard typing happen in insert mode
        return;
      }

      if (vimState === 'NORMAL') {
        e.preventDefault(); // Prevent standard typing in Normal mode

        // Enter Insert Mode
        if (e.key === 'i') {
          setVimState('INSERT');
          setVimStatusMsg('-- INSERT --');
          textarea.focus();
          return;
        }

        if (e.key === 'a') {
          setVimState('INSERT');
          setVimStatusMsg('-- INSERT --');
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = Math.min(value.length, selectionStart + 1);
          updateCursorPosition();
          return;
        }

        if (e.key === 'o') {
          // New line below
          const lines = value.split('\n');
          const curLineIndex = cursorPos.line - 1;
          lines.splice(curLineIndex + 1, 0, '');
          const newValue = lines.join('\n');
          setCurrentCode(newValue);
          setVimState('INSERT');
          setVimStatusMsg('-- INSERT --');
          setTimeout(() => {
            const newPos = lines.slice(0, curLineIndex + 1).join('\n').length + 1;
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = newPos;
            updateCursorPosition();
          }, 0);
          return;
        }

        if (e.key === 'O') {
          // New line above
          const lines = value.split('\n');
          const curLineIndex = cursorPos.line - 1;
          lines.splice(curLineIndex, 0, '');
          const newValue = lines.join('\n');
          setCurrentCode(newValue);
          setVimState('INSERT');
          setVimStatusMsg('-- INSERT --');
          setTimeout(() => {
            const newPos = lines.slice(0, curLineIndex).join('\n').length;
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = newPos;
            updateCursorPosition();
          }, 0);
          return;
        }

        // Navigation in Normal Mode (h, j, k, l)
        if (e.key === 'h' || e.key === 'ArrowLeft') {
          textarea.selectionStart = textarea.selectionEnd = Math.max(0, selectionStart - 1);
          updateCursorPosition();
          return;
        }
        if (e.key === 'l' || e.key === 'ArrowRight') {
          textarea.selectionStart = textarea.selectionEnd = Math.min(value.length, selectionStart + 1);
          updateCursorPosition();
          return;
        }
        if (e.key === 'j' || e.key === 'ArrowDown') {
          const lines = value.split('\n');
          if (cursorPos.line < lines.length) {
            const targetLine = cursorPos.line;
            const targetCol = Math.min(cursorPos.col, lines[targetLine].length + 1);
            const newPos = lines.slice(0, targetLine).join('\n').length + targetCol;
            textarea.selectionStart = textarea.selectionEnd = newPos;
            updateCursorPosition();
          }
          return;
        }
        if (e.key === 'k' || e.key === 'ArrowUp') {
          if (cursorPos.line > 1) {
            const lines = value.split('\n');
            const targetLine = cursorPos.line - 2;
            const targetCol = Math.min(cursorPos.col, lines[targetLine].length + 1);
            const newPos = (targetLine === 0 ? 0 : lines.slice(0, targetLine).join('\n').length + 1) + (targetCol - 1);
            textarea.selectionStart = textarea.selectionEnd = newPos;
            updateCursorPosition();
          }
          return;
        }

        // Delete char: 'x'
        if (e.key === 'x') {
          if (selectionStart < value.length) {
            const newValue = value.substring(0, selectionStart) + value.substring(selectionStart + 1);
            setCurrentCode(newValue);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = selectionStart;
              updateCursorPosition();
            }, 0);
          }
          return;
        }

        // Delete line: 'dd'
        if (e.key === 'd') {
          if (lastKeyRef.current === 'd') {
            const lines = value.split('\n');
            const curLineIndex = cursorPos.line - 1;
            const deletedLine = lines[curLineIndex];
            setClipboardBuffer(deletedLine);
            lines.splice(curLineIndex, 1);
            const newValue = lines.join('\n');
            setCurrentCode(newValue);
            lastKeyRef.current = '';
            setVimStatusMsg(`1 line deleted (yanked: "${deletedLine.trim().substring(0, 20)}")`);
            setTimeout(() => {
              const newPos = lines.slice(0, Math.min(curLineIndex, lines.length - 1)).join('\n').length;
              textarea.selectionStart = textarea.selectionEnd = newPos;
              updateCursorPosition();
            }, 0);
            return;
          } else {
            lastKeyRef.current = 'd';
            setTimeout(() => { lastKeyRef.current = ''; }, 1000);
            return;
          }
        }

        // Yank line: 'yy'
        if (e.key === 'y') {
          if (lastKeyRef.current === 'y') {
            const lines = value.split('\n');
            const curLine = lines[cursorPos.line - 1] || '';
            setClipboardBuffer(curLine);
            setVimStatusMsg(`1 line yanked`);
            lastKeyRef.current = '';
            return;
          } else {
            lastKeyRef.current = 'y';
            setTimeout(() => { lastKeyRef.current = ''; }, 1000);
            return;
          }
        }

        // Paste line below: 'p'
        if (e.key === 'p') {
          if (clipboardBuffer) {
            const lines = value.split('\n');
            const curLineIndex = cursorPos.line - 1;
            lines.splice(curLineIndex + 1, 0, clipboardBuffer);
            const newValue = lines.join('\n');
            setCurrentCode(newValue);
            setVimStatusMsg('Pasted from buffer');
          }
          return;
        }

        // Undo: 'u'
        if (e.key === 'u') {
          if (historyStack.length > 0) {
            const prev = historyStack[historyStack.length - 1];
            setHistoryStack(historyStack.slice(0, -1));
            if (activeView === 'json') setJsonCode(prev);
            else setDockerCode(prev);
            setVimStatusMsg('1 change undone');
          } else {
            setVimStatusMsg('Already at oldest change');
          }
          return;
        }

        // Jump to start of line '0' or end of line '$'
        if (e.key === '0' || e.key === '^') {
          const lines = value.split('\n');
          const curLineIndex = cursorPos.line - 1;
          const pos = curLineIndex === 0 ? 0 : lines.slice(0, curLineIndex).join('\n').length + 1;
          textarea.selectionStart = textarea.selectionEnd = pos;
          updateCursorPosition();
          return;
        }
        if (e.key === '$') {
          const lines = value.split('\n');
          const curLineIndex = cursorPos.line - 1;
          const pos = lines.slice(0, curLineIndex + 1).join('\n').length;
          textarea.selectionStart = textarea.selectionEnd = pos;
          updateCursorPosition();
          return;
        }

        // Jump to top 'gg' or bottom 'G'
        if (e.key === 'g') {
          if (lastKeyRef.current === 'g') {
            textarea.selectionStart = textarea.selectionEnd = 0;
            updateCursorPosition();
            lastKeyRef.current = '';
            return;
          } else {
            lastKeyRef.current = 'g';
            setTimeout(() => { lastKeyRef.current = ''; }, 1000);
            return;
          }
        }
        if (e.key === 'G') {
          textarea.selectionStart = textarea.selectionEnd = value.length;
          updateCursorPosition();
          return;
        }

        // Command Mode Trigger ':'
        if (e.key === ':') {
          setVimState('COMMAND');
          setVimCommand(':');
          return;
        }
      }

      if (vimState === 'COMMAND') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setVimState('NORMAL');
          setVimCommand('');
          setVimStatusMsg('-- NORMAL --');
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          const cmd = vimCommand.trim();
          if (cmd === ':w' || cmd === ':write') {
            handleDownload();
          } else if (cmd === ':q' || cmd === ':quit') {
            setVimStatusMsg('Quit command mode');
          } else if (cmd === ':wq' || cmd === ':x') {
            handleDownload();
          } else if (cmd === ':format' || cmd === ':fmt') {
            handleFormatJson();
          } else if (cmd === ':help') {
            setVimStatusMsg('دستورات: :w (ذخیره), :format (فرمت‌بندی), :q (خروج), i (حالت ویرایش), u (بازگشت)');
          } else {
            setVimStatusMsg(`دستور نامعتبر: ${cmd} (برای راهنما :help را بنویسید)`);
          }
          setVimState('NORMAL');
          setVimCommand('');
          return;
        }

        if (e.key === 'Backspace') {
          e.preventDefault();
          if (vimCommand.length <= 1) {
            setVimState('NORMAL');
            setVimCommand('');
            setVimStatusMsg('-- NORMAL --');
          } else {
            setVimCommand(vimCommand.slice(0, -1));
          }
          return;
        }

        // Append character to command
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setVimCommand(vimCommand + e.key);
        }
      }
    }
  };

  const lineCount = (currentCode.match(/\n/g) || []).length + 1;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        {/* Title & Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#ffffff15] gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0076ff]/20 border border-[#0076ff]/30 flex items-center justify-center text-[#38bdf8]">
                <Settings className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-white">استودیوی تعاملی تولید کانفیگ (Config Studio)</h2>
            </div>
            <p className="text-xs text-[#a0acb7] mt-1">
              تولید و ویرایش هوشمند فایل‌های <code className="text-[#38bdf8]">liara.json</code> و <code className="text-[#38bdf8]">Dockerfile</code> با ادیتور یکپارچه و حالت Vim
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isManualEdit && (
              <button
                onClick={handleResetFromForm}
                className="bg-[#222222] hover:bg-[#282828] border border-[#ffffff15] text-[#a0acb7] hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                title="همگام‌سازی مجدد کد بر اساس مقادیر فرم"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">همگام‌سازی از فرم</span>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="bg-[#222222] hover:bg-[#282828] border border-[#ffffff15] text-[#eeeeee] px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'کپی شد' : 'کپی فایل'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="liara-btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود فایل</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Panel (6 Cols) */}
          <div className="lg:col-span-6 space-y-4">
            {/* 1. Platform Selection */}
            <div className="liara-card p-4 space-y-3">
              <label className="text-xs font-semibold text-[#cbd5e1] block">
                ۱. انتخاب پلتفرم اجرایی برنامه
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {platforms.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePlatformChange(p.id)}
                    className={`p-2.5 rounded-xl border text-xs font-medium transition flex items-center justify-center ${
                      platform === p.id
                        ? 'bg-gradient-to-r from-[#87fcc4] to-[#28c1f5] text-[#111827] font-bold shadow-md shadow-cyan-500/20 border-transparent'
                        : 'bg-[#222222] border-[#ffffff15] text-[#a0acb7] hover:bg-[#282828] hover:text-white'
                    }`}
                  >
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Basic Configuration */}
            <div className="liara-card p-4 space-y-3.5">
              <label className="text-xs font-semibold text-[#cbd5e1] block">
                ۲. مشخصات عمومی برنامه
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#a0acb7] block mb-1">شناسه برنامه در لیارا (App Name)</label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => { setAppName(e.target.value); setIsManualEdit(false); }}
                    className="w-full bg-[#1c1c1f] border border-[#333333] focus:border-[#0076ff] text-[#eeeeee] text-xs rounded-lg p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#a0acb7] block mb-1">پورت داخلی برنامه (Port)</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => { setPort(e.target.value); setIsManualEdit(false); }}
                    className="w-full bg-[#1c1c1f] border border-[#333333] focus:border-[#0076ff] text-[#eeeeee] text-xs rounded-lg p-2.5 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#a0acb7] block mb-1">مسیر بررسی سلامت (Health Check Path)</label>
                <input
                  type="text"
                  value={healthCheck}
                  onChange={(e) => { setHealthCheck(e.target.value); setIsManualEdit(false); }}
                  placeholder="/healthz یا /"
                  className="w-full bg-[#1c1c1f] border border-[#333333] focus:border-[#0076ff] text-[#eeeeee] text-xs rounded-lg p-2.5 outline-none font-mono"
                />
              </div>
            </div>

            {/* 3. Disks Mounts */}
            <div className="liara-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#cbd5e1]">
                  ۳. دیسک‌های پایدار ابری (Disks Mount)
                </label>
                <button
                  onClick={addDisk}
                  className="text-xs text-[#38bdf8] hover:text-[#0076ff] flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن دیسک</span>
                </button>
              </div>

              {disks.length === 0 ? (
                <p className="text-[11px] text-[#7a8a94] py-2">دیسکی تنظیم نشده است.</p>
              ) : (
                disks.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => {
                        const copy = [...disks];
                        copy[i].name = e.target.value;
                        setDisks(copy);
                        setIsManualEdit(false);
                      }}
                      placeholder="نام دیسک (مثلا: uploads)"
                      className="flex-1 bg-[#1c1c1f] border border-[#333333] text-xs rounded-lg p-2 text-[#eeeeee] font-mono outline-none"
                    />
                    <span className="text-[#7a8a94] text-xs">←</span>
                    <input
                      type="text"
                      value={d.mountTo}
                      onChange={(e) => {
                        const copy = [...disks];
                        copy[i].mountTo = e.target.value;
                        setDisks(copy);
                        setIsManualEdit(false);
                      }}
                      placeholder="مسیر مانت (مثلا: /app/uploads)"
                      className="flex-1 bg-[#1c1c1f] border border-[#333333] text-xs rounded-lg p-2 text-[#eeeeee] font-mono outline-none"
                    />
                    <button
                      onClick={() => removeDisk(i)}
                      className="p-2 text-[#e11d48] hover:bg-rose-500/10 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 4. Cron Jobs */}
            <div className="liara-card p-4 space-y-3">
              <label className="text-xs font-semibold text-[#cbd5e1] block">
                ۴. زمان‌بندی کارهای پس‌زمینه (Cron Job)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => { setCronExpression(e.target.value); setIsManualEdit(false); }}
                  placeholder="الگوی کران (مثلا: 0 0 * * *)"
                  className="bg-[#1c1c1f] border border-[#333333] text-xs rounded-lg p-2 text-[#eeeeee] font-mono outline-none"
                />
                <input
                  type="text"
                  value={cronCommand}
                  onChange={(e) => { setCronCommand(e.target.value); setIsManualEdit(false); }}
                  placeholder="دستور (مثلا: python manage.py cleanup)"
                  className="bg-[#1c1c1f] border border-[#333333] text-xs rounded-lg p-2 text-[#eeeeee] font-mono outline-none"
                />
              </div>
            </div>
          </div>

          {/* Interactive Code Editor with Vim Mode (6 Cols) */}
          <div className="lg:col-span-6 flex flex-col h-full space-y-4">
            <div className="liara-card overflow-hidden flex flex-col h-[520px] border border-[#ffffff15] bg-[#141416]">
              {/* Editor Header Bar */}
              <div className="bg-[#1c1c1f] border-b border-[#ffffff15] px-3.5 py-2 flex items-center justify-between select-none">
                {/* File Tabs */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveView('json')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 ${
                      activeView === 'json'
                        ? 'bg-[#0076ff] text-white shadow-sm'
                        : 'text-[#a0acb7] hover:text-white bg-[#222222] border border-[#ffffff10]'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>liara.json</span>
                  </button>
                  <button
                    onClick={() => setActiveView('docker')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 ${
                      activeView === 'docker'
                        ? 'bg-[#0076ff] text-white shadow-sm'
                        : 'text-[#a0acb7] hover:text-white bg-[#222222] border border-[#ffffff10]'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Dockerfile</span>
                  </button>
                </div>

                {/* Mode Selector (Normal vs Vim) */}
                <div className="flex items-center gap-2">
                  {activeView === 'json' && (
                    <button
                      onClick={handleFormatJson}
                      className="text-[11px] text-[#38bdf8] hover:text-white bg-[#222222] hover:bg-[#2a2a2a] border border-[#ffffff15] px-2 py-1 rounded-md transition hidden sm:inline-block"
                      title="فرمت‌بندی کد JSON"
                    >
                      فرمت JSON
                    </button>
                  )}

                  <div className="flex items-center bg-[#111111] p-0.5 rounded-lg border border-[#ffffff15]">
                    <button
                      onClick={() => {
                        setEditorMode('normal');
                        setVimState('NORMAL');
                        setVimStatusMsg('حالت ویرایش عادی');
                      }}
                      className={`px-2 py-0.5 text-[11px] rounded-md transition font-medium ${
                        editorMode === 'normal'
                          ? 'bg-[#2a2a2a] text-white shadow-sm'
                          : 'text-[#7a8a94] hover:text-[#eeeeee]'
                      }`}
                    >
                      عادی
                    </button>
                    <button
                      onClick={() => {
                        setEditorMode('vim');
                        setVimState('NORMAL');
                        setVimStatusMsg('-- NORMAL -- (کلید i برای درج، : برای دستور)');
                      }}
                      className={`px-2 py-0.5 text-[11px] rounded-md transition font-medium flex items-center gap-1 ${
                        editorMode === 'vim'
                          ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                          : 'text-[#7a8a94] hover:text-[#eeeeee]'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Vim</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Code Editor Body with Line Numbers */}
              <div className="relative flex-1 flex overflow-hidden bg-[#101012]" dir="ltr">
                {/* Line Numbers Gutter */}
                <div
                  ref={lineNumbersRef}
                  className="w-11 py-3 px-2 text-right text-[11px] text-[#555555] font-mono select-none bg-[#141416] border-r border-[#222222] overflow-hidden leading-6"
                >
                  {lineNumbers.map((n) => (
                    <div key={n} className={n === cursorPos.line ? 'text-[#38bdf8] font-bold' : ''}>
                      {n}
                    </div>
                  ))}
                </div>

                {/* Editable Code Textarea */}
                <textarea
                  ref={textareaRef}
                  value={currentCode}
                  onChange={(e) => {
                    setCurrentCode(e.target.value);
                    updateCursorPosition();
                  }}
                  onKeyDown={handleKeyDown}
                  onKeyUp={updateCursorPosition}
                  onClick={updateCursorPosition}
                  onScroll={handleScroll}
                  spellCheck={false}
                  placeholder="محتوای کانفیگ..."
                  className={`flex-1 p-3 bg-transparent text-[#38bdf8] font-mono text-xs leading-6 outline-none resize-none overflow-auto whitespace-pre tab-4 ${
                    editorMode === 'vim' && vimState === 'NORMAL' ? 'caret-transparent cursor-default' : 'caret-[#ffffff]'
                  }`}
                  style={{ tabSize: 2 }}
                />
              </div>

              {/* Vim & Editor Status Bar */}
              <div className="bg-[#18181b] border-t border-[#222222] px-3 py-1.5 flex items-center justify-between text-[11px] font-mono select-none text-[#a0acb7]">
                <div className="flex items-center gap-2.5">
                  {editorMode === 'vim' ? (
                    <>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        vimState === 'INSERT'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : vimState === 'COMMAND'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-[#0076ff]/20 text-[#38bdf8] border border-[#0076ff]/30'
                      }`}>
                        -- {vimState} --
                      </span>
                      {vimState === 'COMMAND' ? (
                        <span className="text-amber-300 font-bold">{vimCommand}</span>
                      ) : (
                        <span className="text-[11px] text-[#7a8a94] font-sans truncate max-w-[280px]">
                          {vimStatusMsg}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-[#7a8a94] font-sans">
                      {isManualEdit ? 'ویرایش دستی فعال است' : 'همگام با تنظیمات فرم'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                  <span>
                    سطر <b className="text-white font-mono">{cursorPos.line}</b>، ستون <b className="text-white font-mono">{cursorPos.col}</b>
                  </span>
                  <span className="text-[#555555]">|</span>
                  <span className="uppercase text-[#38bdf8]">{activeView}</span>
                </div>
              </div>

              {/* Deployment Quick CLI Tip */}
              <div className="p-3 bg-[#181818] border-t border-[#ffffff10]">
                <p className="text-[11px] text-[#a0acb7] mb-1.5 font-sans">
                  دستور استقرار سریع در لیارا CLI:
                </p>
                <div className="bg-[#101012] p-2 rounded-lg border border-[#333333] flex items-center justify-between text-xs font-mono text-[#e2e8f0]" dir="ltr">
                  <code>liara deploy --app {appName || 'my-app'}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`liara deploy --app ${appName || 'my-app'}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="text-[#a0acb7] hover:text-white transition p-1"
                    title="کپی دستور"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
