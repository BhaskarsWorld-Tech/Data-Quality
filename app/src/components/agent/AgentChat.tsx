'use client'
import { useState, useRef, useEffect } from 'react'
import { AgentMessage } from '@/lib/types'

// Sparkle AI icon matching the provided design
function SparkleIcon({ size = 24, white = false }: { size?: number; white?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Rounded square outline */}
      <rect x="10" y="18" width="72" height="72" rx="14" ry="14"
        stroke={white ? 'white' : 'white'} strokeWidth="7" fill="none" />
      {/* Big sparkle (bottom-left) */}
      <path d="M32 68 L36 54 L40 68 L54 72 L40 76 L36 90 L32 76 L18 72 Z"
        fill={white ? 'white' : 'white'} />
      {/* Medium sparkle (top-right) */}
      <path d="M62 30 L65 22 L68 30 L76 33 L68 36 L65 44 L62 36 L54 33 Z"
        fill={white ? 'white' : 'white'} />
      {/* Small sparkle dot (top-right corner) */}
      <path d="M78 18 L80 13 L82 18 L87 20 L82 22 L80 27 L78 22 L73 20 Z"
        fill={white ? 'white' : 'white'} />
    </svg>
  )
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#1e293b' }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <div key={i} style={{ fontWeight: 700, fontSize: '14px', margin: '8px 0 4px', color: '#0f172a' }}>{line.slice(3)}</div>
        if (line.startsWith('# ')) return <div key={i} style={{ fontWeight: 700, fontSize: '15px', margin: '8px 0 4px', color: '#0f172a' }}>{line.slice(2)}</div>
        if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ paddingLeft: '12px', marginBottom: '2px' }}>• {line.slice(2)}</div>
        if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 700 }}>{line.slice(2, -2)}</div>
        if (line === '') return <div key={i} style={{ height: '6px' }} />
        // Handle inline bold
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <div key={i} style={{ marginBottom: '1px' }}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part
            )}
          </div>
        )
      })}
    </div>
  )
}

const SUGGESTIONS = [
  "Show me my connections",
  "Add a PostgreSQL connection",
  "Create a not-null rule",
  "Run a quality check",
  "Show latest report",
  "What rules do I have?",
]

const INITIAL_MSG: AgentMessage = {
  role: 'assistant',
  content: "Hi! I'm **DataGuard AI** 🛡️\n\nI can help you:\n- **Add connections** to your databases\n- **Create quality rules** (null checks, uniqueness, ranges, patterns)\n- **Run quality checks** and view reports\n- **Answer questions** about data quality\n\nWhat would you like to do?",
  timestamp: '2026-01-01T00:00:00.000Z'   // stable — avoids server/client hydration mismatch
}

export default function AgentChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([INITIAL_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: AgentMessage = { role: 'user', content: msg, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        toolsUsed: data.toolsUsed
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div className="slide-up" style={{
          position: 'fixed', bottom: '80px', right: '20px', width: '400px', height: '580px',
          background: '#fff', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', zIndex: 1000,
          border: '1px solid rgba(99,102,241,0.15)', overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #4f8ef7, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37,99,235,0.4)'
            }}><SparkleIcon size={24} white /></div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>DataGuard AI</div>
              <div style={{ color: '#10b981', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                Online & Ready
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#94a3b8', width: '28px', height: '28px', borderRadius: '8px',
              cursor: 'pointer', fontSize: '14px'
            }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, i) => (
              <div key={i} className="fade-in" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f8ef7, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: '8px', marginTop: '2px' }}><SparkleIcon size={18} white /></div>
                )}
                <div style={{
                  maxWidth: '85%',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f8fafc',
                  color: msg.role === 'user' ? '#fff' : '#1e293b',
                  padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize: '13px', lineHeight: '1.5',
                  border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none'
                }}>
                  {msg.role === 'assistant' ? <MarkdownText text={msg.content} /> : msg.content}
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {msg.toolsUsed.map((t, j) => (
                        <span key={j} style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 500 }}>
                          ⚡ {t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f8ef7, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SparkleIcon size={18} white /></div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1',
                      animation: `bounce 1.2s ease-in-out ${j * 0.2}s infinite`
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions (only at start) */}
            {messages.length === 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px',
                    padding: '6px 12px', fontSize: '12px', color: '#6366f1', cursor: 'pointer',
                    fontWeight: 500, transition: 'all 0.2s'
                  }}>{s}</button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask me anything about data quality..."
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '12px', fontSize: '13px',
                  border: '1px solid #e2e8f0', outline: 'none', background: '#f8fafc',
                  color: '#0f172a'
                }}
              />
              <button onClick={() => send()} disabled={!input.trim() || loading} style={{
                width: '38px', height: '38px', borderRadius: '10px', border: 'none',
                background: input.trim() && !loading ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e2e8f0',
                color: input.trim() && !loading ? '#fff' : '#94a3b8',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', flexShrink: 0
              }}>↑</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button onClick={() => setOpen(!open)} style={{
        position: 'fixed', bottom: '20px', right: '20px',
        width: '56px', height: '56px', borderRadius: '18px', border: 'none',
        background: 'linear-gradient(145deg, #5b9cf6, #2563eb)',
        cursor: 'pointer', zIndex: 1001,
        boxShadow: '0 8px 28px rgba(37,99,235,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.25s', transform: open ? 'scale(0.9)' : 'scale(1)'
      }}>
        {open
          ? <span style={{ color: '#fff', fontSize: '20px', fontWeight: 300, lineHeight: 1 }}>✕</span>
          : <SparkleIcon size={32} white />}
      </button>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  )
}
