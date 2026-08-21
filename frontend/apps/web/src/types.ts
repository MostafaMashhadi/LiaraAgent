export interface LiaraUser {
  id: string
  email: string
  name: string
  role: string
}

export interface DocSource {
  url: string
  title: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: DocSource[]
  suggested_next?: string[]
  duration_ms?: number
}

export interface StreamMessage {
  type: 'token' | 'done' | 'error'
  token?: string
  message?: string
  sources?: DocSource[]
  suggested_next?: string[]
  duration_ms?: number
  error?: string
  session_id?: string
}

export interface DocChunk {
  id?: string
  title?: string
  doc_title?: string
  section_title?: string
  raw_body?: string
  content?: string
  category?: string
  file_path?: string
  original_url?: string
  [key: string]: unknown
}

export interface DocResult {
  id?: string
  chunk?: DocChunk
  score?: number
  category?: string
  original_url?: string
  [key: string]: unknown
}

export interface Session {
  id: string
  title: string
  summary?: string
  messages: ChatMessage[]
}
