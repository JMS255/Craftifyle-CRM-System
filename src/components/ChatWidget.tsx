'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const ADVISOR_SUGGESTIONS = [
  'Draft a follow-up message for a client who went quiet',
  'Client says mahal, how do I respond?',
  'What package for 200 pax wedding?',
  'How do I ask for the event details naturally?',
]

const CRM_SUGGESTIONS = [
  'Add a new lead: Maria Santos, birthday, June 28, ₱6,500 bundle',
  'Show me all new leads',
  'Show upcoming bookings',
  'How much revenue do I have this month?',
]

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'advisor' | 'crm'>('advisor')
  const [advisorMessages, setAdvisorMessages] = useState<Message[]>([])
  const [crmMessages, setCrmMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const messages = mode === 'advisor' ? advisorMessages : crmMessages
  const setMessages = mode === 'advisor' ? setAdvisorMessages : setCrmMessages

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const updated: Message[] = [...messages, { role: 'user', content }]
    setMessages(updated)
    setLoading(true)

    const endpoint = mode === 'crm' ? '/api/crafty-assist' : '/api/chat'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      const data = await res.json()
      setMessages([...updated, {
        role: 'assistant',
        content: data.error ? `Error: ${data.error}` : (data.reply ?? ''),
      }])
    } catch {
      setMessages([...updated, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function switchMode(next: 'advisor' | 'crm') {
    setMode(next)
    setInput('')
  }

  const suggestions = mode === 'advisor' ? ADVISOR_SUGGESTIONS : CRM_SUGGESTIONS
  const isCrm = mode === 'crm'

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="print:hidden fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-12 h-12 md:w-14 md:h-14 text-white rounded-full shadow-lg flex items-center justify-center text-xl md:text-2xl transition-all"
        style={{ background: isCrm && open ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : '#4f46e5' }}
        title="Ask Craft AI"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-36 md:bottom-24 right-2 md:right-6 z-50 w-[calc(100vw-16px)] sm:w-80 md:w-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            height: '460px',
            background: 'var(--card)',
            border: '1px solid var(--card-border)',
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{
              background: isCrm
                ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                : '#4f46e5',
            }}
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-base shrink-0">
              {isCrm ? '⚡' : '🤖'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">
                {isCrm ? 'Crafty Assistant' : 'Craft AI'}
              </p>
              <p className="text-indigo-200 text-xs truncate">
                {isCrm ? 'Reads & writes your CRM data' : 'Business advisor'}
              </p>
            </div>
            <button
              onClick={() => { setAdvisorMessages([]); setCrmMessages([]); setInput('') }}
              className="text-indigo-200 hover:text-white text-xs shrink-0"
              title="Clear chat"
            >
              Clear
            </button>
          </div>

          {/* Mode toggle */}
          <div
            className="flex border-b"
            style={{ borderColor: 'var(--card-border)', background: 'var(--subtle-bg)' }}
          >
            <button
              onClick={() => switchMode('advisor')}
              className="flex-1 text-xs py-2 font-medium transition-colors"
              style={{
                color: mode === 'advisor' ? '#6366f1' : 'var(--text-muted)',
                borderBottom: mode === 'advisor' ? '2px solid #6366f1' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              Advisor
            </button>
            <button
              onClick={() => switchMode('crm')}
              className="flex-1 text-xs py-2 font-medium transition-colors"
              style={{
                color: mode === 'crm' ? '#7c3aed' : 'var(--text-muted)',
                borderBottom: mode === 'crm' ? '2px solid #7c3aed' : '2px solid transparent',
                background: 'transparent',
              }}
            >
              ⚡ CRM Actions
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div>
                <p className="text-xs text-center mb-3" style={{ color: 'var(--text-faint)' }}>
                  {isCrm
                    ? 'Tell me what to add, update, or look up in your CRM 👇'
                    : 'Ask me anything about your business 👇'}
                </p>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg transition-colors"
                      style={{
                        background: 'var(--subtle-bg)',
                        border: '1px solid var(--card-border)',
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = isCrm ? '#7c3aed' : '#6366f1'
                        ;(e.currentTarget as HTMLButtonElement).style.color = isCrm ? '#a78bfa' : '#818cf8'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--card-border)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap"
                  style={
                    m.role === 'user'
                      ? {
                          background: isCrm ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#4f46e5',
                          color: '#fff',
                          borderBottomRightRadius: '4px',
                        }
                      : {
                          background: 'var(--subtle-bg)',
                          color: 'var(--text-heading)',
                          border: '1px solid var(--card-border)',
                          borderBottomLeftRadius: '4px',
                        }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="text-sm px-4 py-2 rounded-2xl rounded-bl-sm"
                  style={{ background: 'var(--subtle-bg)', color: 'var(--text-faint)', border: '1px solid var(--card-border)' }}
                >
                  {isCrm ? 'Working on it…' : 'Typing…'}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="border-t px-3 py-2 flex gap-2 items-end"
            style={{ borderColor: 'var(--card-border)' }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              placeholder={isCrm ? 'e.g. Add lead: Juan, birthday June 28…' : 'Ask Craft anything…'}
              className="flex-1 resize-none rounded-xl px-3 py-2 text-sm focus:outline-none max-h-24"
              style={{
                background: 'var(--subtle-bg)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-heading)',
                lineHeight: '1.4',
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="text-white w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
              style={{
                background: isCrm ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#4f46e5',
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  )
}
