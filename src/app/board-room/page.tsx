'use client'

import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import TopBar from '@/components/TopBar'

interface Exchange {
  question: string
  cmo: string; cfo: string; ceo: string
  cmo_rt?: string; cfo_rt?: string; ceo_rt?: string
}

const PERSONAS = [
  { key: 'cmo' as const, name: 'Buchi', role: 'CMO', emoji: '📊', color: 'var(--accent)', muted: 'var(--accent-subtle)', text: 'var(--accent-text)' },
  { key: 'cfo' as const, name: 'Greg',  role: 'CFO', emoji: '💰', color: 'var(--money)',  muted: 'var(--money-muted)',  text: 'var(--money)'  },
  { key: 'ceo' as const, name: 'Alan',  role: 'CEO', emoji: '🎯', color: 'var(--success)',muted: 'var(--success-muted)',text: 'var(--success)'},
]

const CHIPS = [
  'Should I run another ₱4k ad this week?',
  "What's my biggest financial risk right now?",
  'How do I hit ₱100k/month revenue?',
  'Is it the right time to open a studio?',
  'Where are my leads dropping off?',
]

function Avatar({ persona }: { persona: typeof PERSONAS[0] }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 font-bold"
      style={{ background: persona.muted, border: `2px solid ${persona.color}`, color: persona.text }}
    >
      {persona.emoji}
    </div>
  )
}

function AdvisorBubble({ persona, text, faded }: { persona: typeof PERSONAS[0]; text: string; faded?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <Avatar persona={persona} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold mb-1" style={{ color: persona.text }}>
          {persona.name} · {persona.role}
          {faded && <span className="font-normal ml-1" style={{ color: 'var(--text-faint)' }}>reacting</span>}
        </p>
        <div
          className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed"
          style={{
            background: faded ? 'var(--card-elevated)' : persona.muted,
            border: `1px solid ${faded ? 'var(--card-border)' : persona.color + '33'}`,
            color: 'var(--text-body)',
          }}
        >
          {text.split('\n').map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function TypingGroup() {
  return (
    <div className="space-y-3 mb-2">
      {PERSONAS.map((p, i) => (
        <div key={p.key} className="flex items-start gap-2.5" style={{ animationDelay: `${i * 100}ms` }}>
          <Avatar persona={p} />
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: p.text }}>{p.name}</p>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center" style={{ background: p.muted, border: `1px solid ${p.color}33` }}>
              {[0,1,2].map(j => (
                <span key={j} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: p.color, animationDelay: `${i * 100 + j * 150}ms` }} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BoardRoomPage() {
  const [authed, setAuthed] = useState(false)
  const [mode, setMode] = useState<'board' | 'roundtable'>('board')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => { if (user) setAuthed(true) })
    return () => unsub()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [exchanges.length, loading])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/board-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: msg }],
          roundTable: mode === 'roundtable',
        }),
      })
      const data = await res.json()
      setExchanges(h => [...h, {
        question: msg,
        cmo: data.cmo ?? 'No response.',
        cfo: data.cfo ?? 'No response.',
        ceo: data.ceo ?? 'No response.',
        cmo_rt: data.cmo_rt,
        cfo_rt: data.cfo_rt,
        ceo_rt: data.ceo_rt,
      }])
    } catch {
      setExchanges(h => [...h, {
        question: msg,
        cmo: 'Something went wrong. Try again.',
        cfo: 'Something went wrong. Try again.',
        ceo: 'Something went wrong. Try again.',
      }])
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  if (!authed) {
    return <div className="flex items-center justify-center min-h-screen"><p style={{ color: 'var(--text-faint)' }}>Loading…</p></div>
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <TopBar page="Board Room" title="Board Room" subtitle="Buchi · Greg · Alan" />

      {/* Mode toggle */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 max-w-2xl mx-auto w-full">
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          {mode === 'board' ? 'Each advisor responds independently' : 'Advisors debate each other · 2× credits'}
        </p>
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
          {(['board', 'roundtable'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: mode === m ? 'var(--accent)' : 'var(--card-elevated)', color: mode === m ? '#fff' : 'var(--text-muted)' }}
            >
              {m === 'board' ? '🏢 Board' : '🔄 Round Table'}
            </button>
          ))}
        </div>
      </div>

      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 max-w-2xl mx-auto w-full">

        {/* Empty state */}
        {exchanges.length === 0 && !loading && (
          <div className="text-center py-10">
            <div className="flex justify-center gap-2 mb-4">
              {PERSONAS.map(p => <Avatar key={p.key} persona={p} />)}
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-heading)' }}>Your Board is ready</p>
            <p className="text-xs mb-6" style={{ color: 'var(--text-faint)' }}>Buchi (CMO), Greg (CFO), and Alan (CEO) are listening</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {CHIPS.map(chip => (
                <button key={chip} onClick={() => send(chip)}
                  className="text-xs px-3 py-2 rounded-full font-medium"
                  style={{ background: 'var(--card-elevated)', color: 'var(--text-body)', border: '1px solid var(--card-border)' }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Exchanges */}
        {exchanges.map((ex, i) => (
          <div key={i} className="mb-6">
            {/* User question */}
            <div className="flex justify-end mb-4">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm" style={{ background: 'var(--accent)', color: '#fff' }}>
                {ex.question}
              </div>
            </div>

            {/* Initial responses */}
            {PERSONAS.map(p => (
              <AdvisorBubble key={p.key} persona={p} text={ex[p.key]} />
            ))}

            {/* Round Table reactions */}
            {(ex.cmo_rt || ex.cfo_rt || ex.ceo_rt) && (
              <>
                <div className="flex items-center gap-2 my-3 mx-2">
                  <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>↩ reacting to each other</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                </div>
                {PERSONAS.map(p => {
                  const rt = ex[`${p.key}_rt` as keyof Exchange] as string | undefined
                  return rt ? <AdvisorBubble key={p.key} persona={p} text={rt} faded /> : null
                })}
              </>
            )}
          </div>
        ))}

        {/* Loading */}
        {loading && <TypingGroup />}

        <div ref={bottomRef} />
      </div>

      {/* Clear + Input */}
      <div className="px-4 pb-20 md:pb-4 pt-2 max-w-2xl mx-auto w-full" style={{ borderTop: '1px solid var(--card-border)' }}>
        {exchanges.length > 0 && (
          <div className="flex justify-end mb-2">
            <button onClick={() => setExchanges([])} className="text-xs px-2.5 py-1 rounded-lg" style={{ color: 'var(--text-faint)', background: 'var(--card-elevated)', border: '1px solid var(--card-border)' }}>
              Clear chat
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask the board…"
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--card-elevated)', color: 'var(--text-body)', border: '1px solid var(--card-border)' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-12 h-12 flex items-center justify-center rounded-xl shrink-0 disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
