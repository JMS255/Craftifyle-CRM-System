'use client'

import { useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function FinanceAIInput({ onRefresh }: { onRefresh?: () => void }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastReply, setLastReply] = useState<string | null>(null)
  const [history, setHistory] = useState<Message[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setLoading(true)
    setInput('')
    setLastReply(null)

    const newHistory: Message[] = [...history, { role: 'user', content: text }]
    setHistory(newHistory)

    try {
      const res = await fetch('/api/personal-finance-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      })
      const data = await res.json()
      const reply: string = data.reply ?? 'Done.'
      setLastReply(reply)
      setHistory(h => [...h, { role: 'assistant', content: reply }])
      onRefresh?.()
    } catch {
      setLastReply('Something went wrong. Please try again.')
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div
      className="rounded-2xl mb-4 overflow-hidden"
      style={{
        background: 'var(--card-elevated)',
        border: '1px solid var(--accent)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* AI reply bubble */}
      {lastReply && (
        <div className="px-4 pt-3 pb-1">
          <div
            className="rounded-xl px-3 py-2.5 flex items-start gap-2"
            style={{ background: 'var(--accent-subtle)' }}
          >
            <span className="text-base shrink-0 leading-snug">✨</span>
            <p className="text-sm leading-snug flex-1" style={{ color: 'var(--accent-text)' }}>
              {lastReply}
            </p>
            <button
              onClick={() => setLastReply(null)}
              className="shrink-0 text-xs leading-none mt-0.5"
              style={{ color: 'var(--text-faint)' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="spent 500 gas · earned 5000 · paid camera july…"
          className="flex-1 rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'var(--card-elevated)',
            color: 'var(--text-body)',
            border: '1px solid var(--card-border)',
          }}
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0 disabled:opacity-40 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          {loading ? (
            <span
              className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
            />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
