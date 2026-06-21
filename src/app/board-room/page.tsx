'use client'

import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import TopBar from '@/components/TopBar'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RoundTableEntry {
  question: string
  cmo: string; cfo: string; ceo: string
  cmo_rt: string; cfo_rt: string; ceo_rt: string
}

const CHIPS = [
  'Should I run another ₱4k ad this week?',
  'What\'s my biggest financial risk right now?',
  'How do I hit ₱100k/month revenue?',
  'Is it the right time to open a studio?',
  'Where are my leads dropping off?',
]

const PERSONAS = [
  { key: 'cmo' as const, name: 'Buchi', role: 'CMO', emoji: '📊', color: 'var(--accent)', muted: 'var(--accent-subtle)', text: 'var(--accent-text)' },
  { key: 'cfo' as const, name: 'Greg',  role: 'CFO', emoji: '💰', color: 'var(--money)',  muted: 'var(--money-muted)',  text: 'var(--money)'  },
  { key: 'ceo' as const, name: 'Alan',  role: 'CEO', emoji: '🎯', color: 'var(--success)',muted: 'var(--success-muted)',text: 'var(--success)'},
]

function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex gap-1 items-center py-1">
      {[0,1,2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: color, animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  )
}

function PersonaCard({
  persona, messages, loading,
}: {
  persona: typeof PERSONAS[0]
  messages: Message[]
  loading: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length, loading])

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--card-elevated)', border: '1px solid var(--card-border)', minHeight: 260 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: persona.muted, borderBottom: '1px solid var(--card-border)' }}>
        <span className="text-xl">{persona.emoji}</span>
        <div>
          <p className="text-sm font-bold leading-tight" style={{ color: persona.text }}>{persona.name}</p>
          <p className="text-xs leading-tight" style={{ color: persona.text, opacity: 0.7 }}>{persona.role} · Craftifyle</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ maxHeight: 320 }}>
        {messages.length === 0 && !loading && (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-faint)' }}>Ask {persona.name} a question below</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-snug"
              style={msg.role === 'user'
                ? { background: persona.color, color: '#fff', borderBottomRightRadius: 4 }
                : { background: 'var(--card-bg)', color: 'var(--text-body)', border: '1px solid var(--card-border)', borderBottomLeftRadius: 4 }
              }
            >
              {msg.content.split('\n').map((line, j, arr) => (
                <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderBottomLeftRadius: 4 }}>
              <TypingDots color={persona.color} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default function BoardRoomPage() {
  const [authed, setAuthed] = useState(false)
  const [mode, setMode] = useState<'board' | 'roundtable'>('board')
  const [cmoMsgs, setCmoMsgs] = useState<Message[]>([])
  const [cfoMsgs, setCfoMsgs] = useState<Message[]>([])
  const [ceoMsgs, setCeoMsgs] = useState<Message[]>([])
  const [rtHistory, setRtHistory] = useState<RoundTableEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => { if (user) setAuthed(true) })
    return () => unsub()
  }, [])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setLoading(true)

    if (mode === 'board') {
      const userMsg: Message = { role: 'user', content: msg }
      const newCmo = [...cmoMsgs, userMsg]
      const newCfo = [...cfoMsgs, userMsg]
      const newCeo = [...ceoMsgs, userMsg]
      setCmoMsgs(newCmo); setCfoMsgs(newCfo); setCeoMsgs(newCeo)

      try {
        const res = await fetch('/api/board-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: newCmo, roundTable: false }),
        })
        const data = await res.json()
        setCmoMsgs(h => [...h, { role: 'assistant', content: data.cmo ?? 'Done.' }])
        setCfoMsgs(h => [...h, { role: 'assistant', content: data.cfo ?? 'Done.' }])
        setCeoMsgs(h => [...h, { role: 'assistant', content: data.ceo ?? 'Done.' }])
      } catch {
        const err = { role: 'assistant' as const, content: 'Something went wrong. Try again.' }
        setCmoMsgs(h => [...h, err]); setCfoMsgs(h => [...h, err]); setCeoMsgs(h => [...h, err])
      }
    } else {
      // Round Table mode
      try {
        const res = await fetch('/api/board-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: msg }], roundTable: true }),
        })
        const data = await res.json()
        setRtHistory(h => [...h, {
          question: msg,
          cmo: data.cmo ?? '', cfo: data.cfo ?? '', ceo: data.ceo ?? '',
          cmo_rt: data.cmo_rt ?? '', cfo_rt: data.cfo_rt ?? '', ceo_rt: data.ceo_rt ?? '',
        }])
      } catch {
        setRtHistory(h => [...h, {
          question: msg,
          cmo: 'Error', cfo: 'Error', ceo: 'Error',
          cmo_rt: '', cfo_rt: '', ceo_rt: '',
        }])
      }
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p style={{ color: 'var(--text-faint)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32 md:pb-8" style={{ background: 'var(--bg)' }}>
      <TopBar page="Board Room" title="Board Room" subtitle="Your AI leadership team" />

      <div className="p-4 md:p-6 max-w-6xl mx-auto">

        {/* Mode toggle */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {mode === 'board' ? 'Independent advice from each advisor' : 'Advisors debate each other — uses 2× credits'}
          </p>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
            {(['board', 'roundtable'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: mode === m ? 'var(--accent)' : 'var(--card-elevated)',
                  color: mode === m ? '#fff' : 'var(--text-muted)',
                }}
              >
                {m === 'board' ? '🏢 Board' : '🔄 Round Table'}
              </button>
            ))}
          </div>
        </div>

        {/* Board mode */}
        {mode === 'board' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {PERSONAS.map(p => (
                <PersonaCard
                  key={p.key}
                  persona={p}
                  messages={p.key === 'cmo' ? cmoMsgs : p.key === 'cfo' ? cfoMsgs : ceoMsgs}
                  loading={loading}
                />
              ))}
            </div>

            {/* Clear */}
            {(cmoMsgs.length > 0 || cfoMsgs.length > 0 || ceoMsgs.length > 0) && (
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => { setCmoMsgs([]); setCfoMsgs([]); setCeoMsgs([]) }}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: 'var(--text-faint)', background: 'var(--card-elevated)', border: '1px solid var(--card-border)' }}
                >
                  Clear all
                </button>
              </div>
            )}
          </>
        )}

        {/* Round Table mode */}
        {mode === 'roundtable' && (
          <div className="space-y-6 mb-4">
            {rtHistory.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-2xl mb-2">🏛️</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Round Table</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Ask a big question — Buchi, Greg & Alan will debate it</p>
              </div>
            )}
            {loading && rtHistory.length === 0 && (
              <div className="card p-6 text-center">
                <p className="text-xs mb-3" style={{ color: 'var(--text-faint)' }}>Board is deliberating…</p>
                <div className="flex justify-center gap-4">
                  {PERSONAS.map(p => <TypingDots key={p.key} color={p.color} />)}
                </div>
              </div>
            )}
            {rtHistory.map((entry, i) => (
              <div key={i} className="space-y-3">
                {/* Question */}
                <div className="flex justify-end">
                  <div className="rounded-2xl px-4 py-2.5 text-sm max-w-[80%]" style={{ background: 'var(--accent)', color: '#fff', borderBottomRightRadius: 4 }}>
                    {entry.question}
                  </div>
                </div>

                {/* Round 1 */}
                <p className="text-xs font-semibold px-1" style={{ color: 'var(--text-faint)' }}>Initial responses</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {PERSONAS.map(p => (
                    <div key={p.key} className="rounded-xl p-3" style={{ background: p.muted, border: `1px solid ${p.color}22` }}>
                      <p className="text-xs font-bold mb-1.5" style={{ color: p.text }}>{p.emoji} {p.name}</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-body)' }}>
                        {entry[p.key]}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Round 2 */}
                {(entry.cmo_rt || entry.cfo_rt || entry.ceo_rt) && (
                  <>
                    <p className="text-xs font-semibold px-1 pt-1" style={{ color: 'var(--text-faint)' }}>↩ Reacting to each other</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {PERSONAS.map(p => (
                        <div key={p.key} className="rounded-xl p-3" style={{ background: 'var(--card-elevated)', border: '1px solid var(--card-border)' }}>
                          <p className="text-xs font-bold mb-1.5" style={{ color: p.text }}>{p.emoji} {p.name}</p>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-body)' }}>
                            {entry[`${p.key}_rt` as keyof RoundTableEntry] as string}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
            {loading && rtHistory.length > 0 && (
              <div className="flex justify-center gap-4 py-4">
                {PERSONAS.map(p => <TypingDots key={p.key} color={p.color} />)}
              </div>
            )}
          </div>
        )}

        {/* Chips */}
        {(mode === 'board' ? (cmoMsgs.length === 0) : (rtHistory.length === 0)) && !loading && (
          <div className="flex flex-wrap gap-2 mb-4">
            {CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => send(chip)}
                className="text-xs px-3 py-2 rounded-full font-medium"
                style={{ background: 'var(--card-elevated)', color: 'var(--text-body)', border: '1px solid var(--card-border)' }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sticky input */}
      <div
        className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-[14rem] px-4 py-3"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--card-border)' }}
      >
        <div className="max-w-6xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={mode === 'board' ? 'Ask the board a question…' : 'Ask a big question for round table…'}
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
