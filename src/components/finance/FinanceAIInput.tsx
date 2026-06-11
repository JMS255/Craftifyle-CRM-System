'use client'

import { useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const CHIPS = [
  'spent 200 food today',
  'earned 3000 from booking',
  'bayad na camera july',
  'add debt 5000/mo 3 months starting next month',
  'natanggap ko na ang CHED',
  'GCash ko ay 8450 na',
]

export default function FinanceAIInput({ onRefresh }: { onRefresh?: () => void }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Message[]>([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        inputRef.current?.focus()
      }, 80)
    }
  }, [open, history.length])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setLoading(true)
    setOpen(true)

    const newHistory: Message[] = [...history, { role: 'user', content: msg }]
    setHistory(newHistory)

    try {
      const res = await fetch('/api/personal-finance-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      })
      const data = await res.json()
      const reply: string = data.reply ?? 'Done.'
      setHistory(h => [...h, { role: 'assistant', content: reply }])
      onRefresh?.()
    } catch {
      setHistory(h => [...h, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div
      className="rounded-2xl mb-4 overflow-hidden"
      style={{ background: 'var(--card-elevated)', border: '1px solid var(--accent)' }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--accent-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--accent-text)' }}>Crafty AI</span>
          {history.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {history.length}
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
          {open ? '▲' : '▼'} {open ? 'collapse' : 'tap to chat'}
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div>
          {/* History */}
          {history.length > 0 ? (
            <div className="px-3 pt-3 pb-1 space-y-2 max-h-72 overflow-y-auto">
              {history.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug"
                    style={msg.role === 'user'
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--card-bg)', color: 'var(--text-body)', border: '1px solid var(--card-border)' }
                    }
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl px-4 py-2.5 flex gap-1 items-center"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                  >
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: 'var(--accent)', animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          ) : (
            /* Quick chips — only shown when no history yet */
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs mb-2 px-1" style={{ color: 'var(--text-faint)' }}>
                Try saying something like:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => send(chip)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium transition-opacity active:opacity-60"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)', border: '1px solid var(--accent)' }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-2 px-3 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Type anything — Filipino or English…"
              className="flex-1 rounded-xl px-3 py-2.5 text-sm"
              style={{
                background: 'var(--card-bg)',
                color: 'var(--text-body)',
                border: '1px solid var(--card-border)',
              }}
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Collapsed hint — shows last reply preview */}
      {!open && history.length > 0 && (
        <div className="px-4 py-2.5">
          <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>
            {history[history.length - 1].content}
          </p>
        </div>
      )}

      {/* Collapsed placeholder when no history */}
      {!open && history.length === 0 && (
        <div
          className="flex items-center gap-2 px-4 py-3 cursor-pointer"
          onClick={() => setOpen(true)}
        >
          <input
            readOnly
            placeholder="spent 500 food · bayad na camera july · nangutang 3k…"
            className="flex-1 text-sm bg-transparent cursor-pointer outline-none"
            style={{ color: 'var(--text-faint)' }}
          />
        </div>
      )}
    </div>
  )
}
