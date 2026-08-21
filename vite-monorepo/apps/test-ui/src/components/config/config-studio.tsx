import React, { useState, useEffect, useRef, useCallback } from 'react'
import { LuSettings, LuDownload, LuCopy, LuCheck, LuPlus, LuTrash2, LuFileCode2, LuFileCode, LuRotateCcw } from 'react-icons/lu'
import { cn } from '@/lib/utils'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Card } from '@workspace/ui/components/card'
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'

export function ConfigStudio() {
  const [platform, setPlatform] = useState('node')
  const [appName, setAppName] = useState('my-app')
  const [port, setPort] = useState('3000')
  const [healthCheck, setHealthCheck] = useState('/healthz')
  const [cronExpression, setCronExpression] = useState('')
  const [cronCommand, setCronCommand] = useState('')
  const [disks, setDisks] = useState([{ name: 'app-data', mountTo: '/app/storage' }])
  const [envs, setEnvs] = useState([{ key: 'NODE_ENV', value: 'production' }])
  const [copied, setCopied] = useState(false)
  const [activeView, setActiveView] = useState('json')

  const [editorMode, setEditorMode] = useState('normal')
  const [vimState, setVimState] = useState('NORMAL')
  const [vimCommand, setVimCommand] = useState('')
  const [vimStatusMsg, setVimStatusMsg] = useState('حالت نرمال - برای ویرایش کلید i را بزنید')
  const [jsonCode, setJsonCode] = useState('')
  const [dockerCode, setDockerCode] = useState('')
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [clipboardBuffer, setClipboardBuffer] = useState('')
  const [historyStack, setHistoryStack] = useState<string[]>([])
  const [isManualEdit, setIsManualEdit] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const lastKeyRef = useRef('')

  const platforms = [
    { id: 'node', label: 'Node.js', defaultPort: '3000' },
    { id: 'next', label: 'Next.js', defaultPort: '3000' },
    { id: 'laravel', label: 'Laravel', defaultPort: '80' },
    { id: 'django', label: 'Django', defaultPort: '80' },
    { id: 'fastapi', label: 'FastAPI', defaultPort: '8000' },
    { id: 'go', label: 'Go', defaultPort: '8080' },
    { id: 'docker', label: 'Docker', defaultPort: '8080' },
    { id: 'static', label: 'Static', defaultPort: '80' },
  ]

  const handlePlatformChange = (pId: string) => {
    setPlatform(pId)
    const target = platforms.find(p => p.id === pId)
    if (target) {
      setPort(target.defaultPort)
      if (pId === 'laravel') {
        setDisks([{ name: 'storage-disk', mountTo: 'storage' }])
        setEnvs([{ key: 'APP_ENV', value: 'production' }, { key: 'APP_DEBUG', value: 'false' }])
      } else if (pId === 'django') {
        setDisks([{ name: 'media-disk', mountTo: 'media' }])
        setEnvs([{ key: 'DJANGO_SETTINGS_MODULE', value: 'myproject.settings' }])
      } else if (pId === 'go') {
        setDisks([])
        setEnvs([{ key: 'GIN_MODE', value: 'release' }])
      }
    }
    setIsManualEdit(false)
  }

  const addDisk = () => {
    setDisks([...disks, { name: 'new-disk', mountTo: '/app/data' }])
    setIsManualEdit(false)
  }
  const removeDisk = (index: number) => {
    setDisks(disks.filter((_, i) => i !== index))
    setIsManualEdit(false)
  }

  const buildConfigObject = useCallback((): Record<string, unknown> => {
    const config: Record<string, unknown> = {
      app: appName || 'my-app',
      platform: platform,
      port: parseInt(port, 10) || 3000,
    }

    if (healthCheck) {
      config.healthCheck = { path: healthCheck }
    }

    if (disks.length > 0) {
      config.disks = disks.map(d => ({ name: d.name, mountTo: d.mountTo }))
    }

    if (cronExpression && cronCommand) {
      config.cron = [`${cronExpression} ${cronCommand}`]
    }

    if (envs.length > 0) {
      config.env = envs.reduce((acc: Record<string, string>, env: { key: string; value: string }) => {
        if (env.key) acc[env.key] = env.value
        return acc
      }, {} as Record<string, string>)
    }

    return config
  }, [appName, platform, port, healthCheck, disks, cronExpression, cronCommand, envs])

  const buildDockerfile = useCallback((): string => {
    if (platform === 'node' || platform === 'next') {
      return `FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nENV PORT=${port}\nCOPY --from=builder /app ./\nEXPOSE ${port}\nCMD ["npm", "start"]`
    }
    if (platform === 'go') {
      return `FROM golang:1.23-alpine AS builder\nWORKDIR /app\nCOPY go.* ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -o main .\n\nFROM alpine:latest\nWORKDIR /app\nCOPY --from=builder /app/main .\nEXPOSE ${port}\nCMD ["./main"]`
    }
    if (platform === 'django' || platform === 'fastapi') {
      return `FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE ${port}\nCMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:${port}"]`
    }
    return `FROM alpine:latest\nWORKDIR /app\nCOPY . .\nEXPOSE ${port}\nCMD ["echo", "Ready"]`
  }, [platform, port])

  useEffect(() => {
    if (!isManualEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJsonCode(JSON.stringify(buildConfigObject(), null, 2))
      setDockerCode(buildDockerfile())
    }
  }, [buildConfigObject, buildDockerfile, isManualEdit])

  const currentCode = activeView === 'json' ? jsonCode : dockerCode

  const setCurrentCode = (newCode: string) => {
    setHistoryStack(prev => [...prev.slice(-30), currentCode])
    setIsManualEdit(true)
    if (activeView === 'json') {
      setJsonCode(newCode)
    } else {
      setDockerCode(newCode)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const filename = activeView === 'json' ? 'liara.json' : 'Dockerfile'
    const blob = new Blob([currentCode], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setVimStatusMsg(`"${filename}" با موفقیت ذخیره و دانلود شد`)
  }

  const handleFormatJson = () => {
    if (activeView === 'json') {
      try {
        const parsed = JSON.parse(jsonCode)
        setCurrentCode(JSON.stringify(parsed, null, 2))
        setVimStatusMsg('JSON با موفقیت فرمت‌بندی شد')
      } catch {
        setVimStatusMsg('خطا در فرمت: فرمت JSON نامعتبر است')
      }
    }
  }

  const handleResetFromForm = () => {
    setIsManualEdit(false)
    setJsonCode(JSON.stringify(buildConfigObject(), null, 2))
    setDockerCode(buildDockerfile())
    setVimStatusMsg('کد مجدداً از مشخصات فرم همگام‌سازی شد')
  }

  const updateCursorPosition = () => {
    if (!textareaRef.current) return
    const { selectionStart, value } = textareaRef.current
    const textUpToCursor = value.substring(0, selectionStart)
    const lines = textUpToCursor.split('\n')
    const line = lines.length
    const col = lines[lines.length - 1].length + 1
    setCursorPos({ line, col })
  }

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const { selectionStart, selectionEnd, value } = textarea

    if (e.key === 'Tab') {
      e.preventDefault()
      const start = selectionStart
      const end = selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      setCurrentCode(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
        updateCursorPosition()
      }, 0)
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleDownload()
      return
    }

    if (editorMode === 'vim') {
      if (vimState === 'INSERT') {
        if (e.key === 'Escape') {
          e.preventDefault()
          setVimState('NORMAL')
          setVimStatusMsg('-- NORMAL --')
          textarea.blur()
          return
        }
        return
      }

      if (vimState === 'NORMAL') {
        e.preventDefault()

        if (e.key === 'i') {
          setVimState('INSERT')
          setVimStatusMsg('-- INSERT --')
          textarea.focus()
          return
        }

        if (e.key === 'a') {
          setVimState('INSERT')
          setVimStatusMsg('-- INSERT --')
          textarea.focus()
          textarea.selectionStart = textarea.selectionEnd = Math.min(value.length, selectionStart + 1)
          updateCursorPosition()
          return
        }

        if (e.key === 'o') {
          const lines = value.split('\n')
          const curLineIndex = cursorPos.line - 1
          lines.splice(curLineIndex + 1, 0, '')
          const newValue = lines.join('\n')
          setCurrentCode(newValue)
          setVimState('INSERT')
          setVimStatusMsg('-- INSERT --')
          setTimeout(() => {
            const newPos = lines.slice(0, curLineIndex + 1).join('\n').length + 1
            textarea.focus()
            textarea.selectionStart = textarea.selectionEnd = newPos
            updateCursorPosition()
          }, 0)
          return
        }

        if (e.key === 'O') {
          const lines = value.split('\n')
          const curLineIndex = cursorPos.line - 1
          lines.splice(curLineIndex, 0, '')
          const newValue = lines.join('\n')
          setCurrentCode(newValue)
          setVimState('INSERT')
          setVimStatusMsg('-- INSERT --')
          setTimeout(() => {
            const newPos = lines.slice(0, curLineIndex).join('\n').length
            textarea.focus()
            textarea.selectionStart = textarea.selectionEnd = newPos
            updateCursorPosition()
          }, 0)
          return
        }

        if (e.key === 'h' || e.key === 'ArrowLeft') {
          textarea.selectionStart = textarea.selectionEnd = Math.max(0, selectionStart - 1)
          updateCursorPosition()
          return
        }
        if (e.key === 'l' || e.key === 'ArrowRight') {
          textarea.selectionStart = textarea.selectionEnd = Math.min(value.length, selectionStart + 1)
          updateCursorPosition()
          return
        }
        if (e.key === 'j' || e.key === 'ArrowDown') {
          const lines = value.split('\n')
          if (cursorPos.line < lines.length) {
            const targetLine = cursorPos.line
            const targetCol = Math.min(cursorPos.col, lines[targetLine].length + 1)
            const newPos = lines.slice(0, targetLine).join('\n').length + targetCol
            textarea.selectionStart = textarea.selectionEnd = newPos
            updateCursorPosition()
          }
          return
        }
        if (e.key === 'k' || e.key === 'ArrowUp') {
          if (cursorPos.line > 1) {
            const lines = value.split('\n')
            const targetLine = cursorPos.line - 2
            const targetCol = Math.min(cursorPos.col, lines[targetLine].length + 1)
            const newPos = (targetLine === 0 ? 0 : lines.slice(0, targetLine).join('\n').length + 1) + (targetCol - 1)
            textarea.selectionStart = textarea.selectionEnd = newPos
            updateCursorPosition()
          }
          return
        }

        if (e.key === 'x') {
          if (selectionStart < value.length) {
            const newValue = value.substring(0, selectionStart) + value.substring(selectionStart + 1)
            setCurrentCode(newValue)
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = selectionStart
              updateCursorPosition()
            }, 0)
          }
          return
        }

        if (e.key === 'd') {
          if (lastKeyRef.current === 'd') {
            const lines = value.split('\n')
            const curLineIndex = cursorPos.line - 1
            const deletedLine = lines[curLineIndex]
            setClipboardBuffer(deletedLine)
            lines.splice(curLineIndex, 1)
            const newValue = lines.join('\n')
            setCurrentCode(newValue)
            lastKeyRef.current = ''
            setVimStatusMsg(`1 line deleted (yanked: "${deletedLine.trim().substring(0, 20)}")`)
            setTimeout(() => {
              const newPos = lines.slice(0, Math.min(curLineIndex, lines.length - 1)).join('\n').length
              textarea.selectionStart = textarea.selectionEnd = newPos
              updateCursorPosition()
            }, 0)
            return
          } else {
            lastKeyRef.current = 'd'
            setTimeout(() => { lastKeyRef.current = '' }, 1000)
            return
          }
        }

        if (e.key === 'y') {
          if (lastKeyRef.current === 'y') {
            const lines = value.split('\n')
            const curLine = lines[cursorPos.line - 1] || ''
            setClipboardBuffer(curLine)
            setVimStatusMsg('1 line yanked')
            lastKeyRef.current = ''
            return
          } else {
            lastKeyRef.current = 'y'
            setTimeout(() => { lastKeyRef.current = '' }, 1000)
            return
          }
        }

        if (e.key === 'p') {
          if (clipboardBuffer) {
            const lines = value.split('\n')
            const curLineIndex = cursorPos.line - 1
            lines.splice(curLineIndex + 1, 0, clipboardBuffer)
            const newValue = lines.join('\n')
            setCurrentCode(newValue)
            setVimStatusMsg('Pasted from buffer')
          }
          return
        }

        if (e.key === 'u') {
          if (historyStack.length > 0) {
            const prev = historyStack[historyStack.length - 1]
            setHistoryStack(historyStack.slice(0, -1))
            if (activeView === 'json') setJsonCode(prev)
            else setDockerCode(prev)
            setVimStatusMsg('1 change undone')
          } else {
            setVimStatusMsg('Already at oldest change')
          }
          return
        }

        if (e.key === '0' || e.key === '^') {
          const lines = value.split('\n')
          const curLineIndex = cursorPos.line - 1
          const pos = curLineIndex === 0 ? 0 : lines.slice(0, curLineIndex).join('\n').length + 1
          textarea.selectionStart = textarea.selectionEnd = pos
          updateCursorPosition()
          return
        }
        if (e.key === '$') {
          const lines = value.split('\n')
          const curLineIndex = cursorPos.line - 1
          const pos = lines.slice(0, curLineIndex + 1).join('\n').length
          textarea.selectionStart = textarea.selectionEnd = pos
          updateCursorPosition()
          return
        }

        if (e.key === 'g') {
          if (lastKeyRef.current === 'g') {
            textarea.selectionStart = textarea.selectionEnd = 0
            updateCursorPosition()
            lastKeyRef.current = ''
            return
          } else {
            lastKeyRef.current = 'g'
            setTimeout(() => { lastKeyRef.current = '' }, 1000)
            return
          }
        }
        if (e.key === 'G') {
          textarea.selectionStart = textarea.selectionEnd = value.length
          updateCursorPosition()
          return
        }

        if (e.key === ':') {
          setVimState('COMMAND')
          setVimCommand(':')
          return
        }
      }

      if (vimState === 'COMMAND') {
        if (e.key === 'Escape') {
          e.preventDefault()
          setVimState('NORMAL')
          setVimCommand('')
          setVimStatusMsg('-- NORMAL --')
          return
        }

        if (e.key === 'Enter') {
          e.preventDefault()
          const cmd = vimCommand.trim()
          if (cmd === ':w' || cmd === ':write') {
            handleDownload()
          } else if (cmd === ':q' || cmd === ':quit') {
            setVimStatusMsg('Quit command mode')
          } else if (cmd === ':wq' || cmd === ':x') {
            handleDownload()
          } else if (cmd === ':format' || cmd === ':fmt') {
            handleFormatJson()
          } else if (cmd === ':help') {
            setVimStatusMsg('دستورات: :w (ذخیره), :format (فرمت‌بندی), :q (خروج), i (حالت ویرایش), u (بازگشت)')
          } else {
            setVimStatusMsg(`دستور نامعتبر: ${cmd} (برای راهما :help را بنویسید)`)
          }
          setVimState('NORMAL')
          setVimCommand('')
          return
        }

        if (e.key === 'Backspace') {
          e.preventDefault()
          if (vimCommand.length <= 1) {
            setVimState('NORMAL')
            setVimCommand('')
            setVimStatusMsg('-- NORMAL --')
          } else {
            setVimCommand(vimCommand.slice(0, -1))
          }
          return
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          setVimCommand(vimCommand + e.key)
        }
      }
    }
  }

  const lineCount = (currentCode.match(/\n/g) || []).length + 1
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1)

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-6">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        {/* Title & Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <LuSettings className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground">استودیوی تعاملی تولید کانفیگ (Config Studio)</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              تولید و ویرایش هوشمند فایل‌های <code className="text-primary font-mono">liara.json</code> و <code className="text-primary font-mono">Dockerfile</code> با ادیتور یکپارچه و حالت Vim
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isManualEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFromForm}
                className="hidden sm:flex"
              >
                <LuRotateCcw className="w-3.5 h-3.5" />
                <span>همگام‌سازی از فرم</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? <LuCheck className="w-3.5 h-3.5 text-mint" /> : <LuCopy className="w-3.5 h-3.5" />}
              <span>{copied ? 'کپی شد' : 'کپی فایل'}</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownload}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <LuDownload className="w-3.5 h-3.5" />
              <span>دانلود فایل</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-5 space-y-4">
            {/* 1. Platform Selection */}
            <Card className="p-4 space-y-3 elevation-1">
              <label className="text-xs font-semibold text-foreground block">
                ۱. انتخاب پلتفرم اجرایی برنامه
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {platforms.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePlatformChange(p.id)}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs font-medium transition-all duration-200',
                      platform === p.id
                        ? 'bg-primary text-primary-foreground border-transparent'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            {/* 2. Basic Configuration */}
            <Card className="p-4 space-y-3.5 elevation-1">
              <label className="text-xs font-semibold text-foreground block">
                ۲. مشخصات عمومی برنامه
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground block">شناسه برنامه در لیارا (App Name)</label>
                  <Input
                    type="text"
                    value={appName}
                    onChange={(e) => { setAppName(e.target.value); setIsManualEdit(false) }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground block">پورت داخلی برنامه (Port)</label>
                  <Input
                    type="number"
                    value={port}
                    onChange={(e) => { setPort(e.target.value); setIsManualEdit(false) }}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground block">مسیر بررسی سلامت (Health LuCheck Path)</label>
                <Input
                  type="text"
                  value={healthCheck}
                  onChange={(e) => { setHealthCheck(e.target.value); setIsManualEdit(false) }}
                  placeholder="/healthz یا /"
                  className="font-mono"
                />
              </div>
            </Card>

            {/* 3. Disks Mounts */}
            <Card className="p-4 space-y-3 elevation-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  ۳. دیسک‌های پایدار ابری (Disks Mount)
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addDisk}
                  className="h-7 text-xs"
                >
                  <LuPlus className="w-3.5 h-3.5" />
                  <span>افزودن دیسک</span>
                </Button>
              </div>

              {disks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2">دیسکی تنظیم نشده است.</p>
              ) : (
                <div className="space-y-2">
                  {disks.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={d.name}
                        onChange={(e) => {
                          const copy = [...disks]
                          copy[i].name = e.target.value
                          setDisks(copy)
                          setIsManualEdit(false)
                        }}
                        placeholder="نام دیسک"
                        className="font-mono text-xs"
                      />
                      <span className="text-muted-foreground text-xs">←</span>
                      <Input
                        type="text"
                        value={d.mountTo}
                        onChange={(e) => {
                          const copy = [...disks]
                          copy[i].mountTo = e.target.value
                          setDisks(copy)
                          setIsManualEdit(false)
                        }}
                        placeholder="مسیر مانت"
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDisk(i)}
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      >
                        <LuTrash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 4. Cron Jobs */}
            <Card className="p-4 space-y-3 elevation-1">
              <label className="text-xs font-semibold text-foreground block">
                ۴. زمان‌بندی کارهای پس‌زمینه (Cron Job)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => { setCronExpression(e.target.value); setIsManualEdit(false) }}
                  placeholder="الگوی کران (مثلا: 0 0 * * *)"
                  className="font-mono text-xs"
                />
                <Input
                  type="text"
                  value={cronCommand}
                  onChange={(e) => { setCronCommand(e.target.value); setIsManualEdit(false) }}
                  placeholder="دستور (مثلا: python manage.py cleanup)"
                  className="font-mono text-xs"
                />
              </div>
            </Card>

            {/* 5. Environment Variables */}
            <Card className="p-4 space-y-3 elevation-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  ۵. متغیرهای محیطی (Environment)
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEnvs([...envs, { key: '', value: '' }])}
                  className="h-7 text-xs"
                >
                  <LuPlus className="w-3.5 h-3.5" />
                  <span>افزودن</span>
                </Button>
              </div>

              <div className="space-y-2">
                {envs.map((env, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={env.key}
                      onChange={(e) => {
                        const copy = [...envs]
                        copy[i].key = e.target.value
                        setEnvs(copy)
                        setIsManualEdit(false)
                      }}
                      placeholder="KEY"
                      className="font-mono text-xs"
                    />
                    <span className="text-muted-foreground text-xs">=</span>
                    <Input
                      type="text"
                      value={env.value}
                      onChange={(e) => {
                        const copy = [...envs]
                        copy[i].value = e.target.value
                        setEnvs(copy)
                        setIsManualEdit(false)
                      }}
                      placeholder="value"
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEnvs(envs.filter((_, idx) => idx !== i))}
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    >
                      <LuTrash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Interactive Code Editor */}
          <div className="lg:col-span-7 flex flex-col h-full space-y-4">
            <Card className="overflow-hidden flex flex-col h-[560px] border border-border bg-muted/30 elevation-1">
              {/* Editor Header Bar */}
              <div className="bg-muted/50 border-b border-border px-3.5 py-2 flex items-center justify-between select-none">
                <div className="flex items-center gap-1.5">
                  <Tabs value={activeView} onValueChange={setActiveView} className="bg-transparent p-0">
                    <TabsList className="bg-background/50 border border-border">
                      <TabsTrigger value="json" className="gap-1.5">
                        <LuFileCode className="w-3.5 h-3.5" />
                        <span>liara.json</span>
                      </TabsTrigger>
                      <TabsTrigger value="docker" className="gap-1.5">
                        <LuFileCode2 className="w-3.5 h-3.5" />
                        <span>Dockerfile</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="flex items-center gap-2">
                  {activeView === 'json' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFormatJson}
                      className="h-7 text-xs hidden sm:flex"
                    >
                      فرمت JSON
                    </Button>
                  )}

                  <div className="flex items-center bg-background/50 p-0.5 rounded-lg border border-border">
                    <button
                      onClick={() => {
                        setEditorMode('normal')
                        setVimState('NORMAL')
                        setVimStatusMsg('حالت ویرایش عادی')
                      }}
                      className={cn(
                        'px-2 py-0.5 text-[11px] rounded-md transition font-medium',
                        editorMode === 'normal'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      عادی
                    </button>
                    <button
                      onClick={() => {
                        setEditorMode('vim')
                        setVimState('NORMAL')
                        setVimStatusMsg('-- NORMAL -- (کلید i برای درج، : برای دستور)')
                      }}
                      className={cn(
                        'px-2 py-0.5 text-[11px] rounded-md transition font-medium flex items-center gap-1',
                        editorMode === 'vim'
                          ? 'bg-mint/20 text-mint font-bold border border-mint/30'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
                      <span>Vim</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Code Editor Body with Line Numbers */}
              <div className="relative flex-1 flex overflow-hidden bg-muted/20" dir="ltr">
                <div
                  ref={lineNumbersRef}
                  className="w-11 py-3 px-2 text-right text-[11px] text-muted-foreground font-mono select-none bg-muted/30 border-r border-border overflow-hidden leading-6"
                >
                  {lineNumbers.map((n) => (
                    <div key={n} className={n === cursorPos.line ? 'text-primary font-bold' : ''}>
                      {n}
                    </div>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  value={currentCode}
                  onChange={(e) => {
                    setCurrentCode(e.target.value)
                    updateCursorPosition()
                  }}
                  onKeyDown={handleKeyDown}
                  onKeyUp={updateCursorPosition}
                  onClick={updateCursorPosition}
                  onScroll={handleScroll}
                  spellCheck={false}
                  placeholder="محتوای کانفیگ..."
                  className={cn(
                    'flex-1 p-3 bg-transparent text-foreground font-mono text-xs leading-6 outline-none resize-none overflow-auto whitespace-pre',
                    editorMode === 'vim' && vimState === 'NORMAL' ? 'caret-transparent cursor-default' : 'caret-foreground'
                  )}
                  style={{ tabSize: 2 }}
                />
              </div>

              {/* Vim & Editor Status Bar */}
              <div className="bg-muted/50 border-t border-border px-3 py-1.5 flex items-center justify-between text-[11px] font-mono select-none text-muted-foreground">
                <div className="flex items-center gap-2.5">
                  {editorMode === 'vim' ? (
                    <>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                        vimState === 'INSERT'
                          ? 'bg-mint/20 text-mint border border-mint/30'
                          : vimState === 'COMMAND'
                          ? 'bg-gold/20 text-gold border border-gold/30'
                          : 'bg-primary/20 text-primary border border-primary/30'
                      )}>
                        -- {vimState} --
                      </span>
                      {vimState === 'COMMAND' ? (
                        <span className="text-gold font-bold">{vimCommand}</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-sans truncate max-w-[280px]">
                          {vimStatusMsg}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-sans">
                      {isManualEdit ? 'ویرایش دستی فعال است' : 'همگام با تنظیمات فرم'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                  <span>
                    سطر <b className="text-foreground font-mono">{cursorPos.line}</b>، ستون <b className="text-foreground font-mono">{cursorPos.col}</b>
                  </span>
                  <span className="text-muted-foreground">|</span>
                  <span className="uppercase text-primary">{activeView}</span>
                </div>
              </div>

              {/* Deployment Quick CLI Tip */}
              <div className="p-3 bg-muted/30 border-t border-border">
                <p className="text-[11px] text-muted-foreground mb-1.5 font-sans">
                  دستور استقرار سریع در لیارا CLI:
                </p>
                <div className="bg-muted/20 p-2 rounded-lg border border-border flex items-center justify-between text-xs font-mono text-foreground" dir="ltr">
                  <code>liara deploy --app {appName || 'my-app'}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`liara deploy --app ${appName || 'my-app'}`)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <LuCopy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
