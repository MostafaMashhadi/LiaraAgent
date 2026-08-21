declare module '*.css' {
  const classes: { [key: string]: string }
  export default classes
}

declare module '*.module.css' {
  const classes: { [key: string]: string }
  export default classes
}

interface Window {
  hljs: {
    getLanguage: (lang: string) => boolean
    highlight: (code: string, options: { language: string }) => { value: string }
    highlightAuto: (code: string) => { value: string }
  } | undefined
  copyCodeBlock: (id: string) => void
  SpeechRecognition: typeof SpeechRecognition | undefined
  webkitSpeechRecognition: typeof SpeechRecognition | undefined
}

interface SpeechRecognition {
  new (): SpeechRecognitionInstance
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: { results: unknown[][] }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}
