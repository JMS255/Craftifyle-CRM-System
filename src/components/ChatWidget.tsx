'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'

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
  'What needs my attention today?',
  'Add a new lead: Maria Santos, birthday, June 28, ₱6,500 bundle',
  'Show upcoming bookings',
  'How much revenue do I have this month?',
]

export default function ChatWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'advisor' | 'crm'>('advisor')
  const [advisorMessages, setAdvisorMessages] = useState<Message[]>([])
  const [crmMessages, setCrmMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [showPulse, setShowPulse] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const messages = mode === 'advisor' ? advisorMessages : crmMessages
  const setMessages = mode === 'advisor' ? setAdvisorMessages : setCrmMessages

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Pulse + tooltip for discoverability
  useEffect(() => {
    const seen = parseInt(localStorage.getItem('crafty-seen') || '0')
    if (seen < 3) setShowPulse(true)
    if (seen === 0) setShowTooltip(true)
  }, [])

  // Listen for external prompt triggers (from dashboard chips)
  useEffect(() => {
    function onPrompt(e: Event) {
      const { prompt, mode: m } = (e as CustomEvent).detail
      setOpen(true)
      if (m) setMode(m)
      setInput(prompt)
    }
    window.addEventListener('crafty-prompt', onPrompt)
    return () => window.removeEventListener('crafty-prompt', onPrompt)
  }, [])

  function handleOpen() {
    setOpen(v => !v)
    setShowTooltip(false)
    const seen = parseInt(localStorage.getItem('crafty-seen') || '0')
    localStorage.setItem('crafty-seen', String(seen + 1))
    if (seen >= 2) setShowPulse(false)
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const updated: Message[] = [...messages, { role: 'user', content }]
    setMessages(updated)
    setLoading(true)

    const endpoint = mode === 'crm' ? '/api/crafty-assist' : '/api/chat'

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
        signal: controller.signal,
      })
      const data = await res.json()
      setMessages([...updated, {
        role: 'assistant',
        content: data.error ? `Error: ${data.error}` : (data.reply ?? ''),
      }])
    } catch (err) {
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out. Try a shorter message or try again.'
        : 'Something went wrong. Try again.'
      setMessages([...updated, { role: 'assistant', content: msg }])
    } finally {
      clearTimeout(timeoutId)
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
    setPasteOpen(false)
    setPasteText('')
  }

  async function submitPaste() {
    if (!pasteText.trim() || loading) return
    const msg = `Parse this client inquiry and create a lead: ${pasteText.trim()}`
    setPasteText('')
    setPasteOpen(false)
    await send(msg)
  }

  const suggestions = mode === 'advisor' ? ADVISOR_SUGGESTIONS : CRM_SUGGESTIONS
  const isCrm = mode === 'crm'

  if (pathname === '/login' || pathname === '/signup' || pathname?.startsWith('/confirm') || pathname?.startsWith('/contract')) return null

  return (
    <>
      {/* Floating button + pulse + tooltip */}
      <div className="print:hidden fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end gap-2">
        {/* Tooltip bubble */}
        {showTooltip && !open && (
          <div className="relative max-w-[200px] rounded-2xl px-4 py-3 text-xs shadow-xl"
            style={{ background: '#1e1e30', border: '1px solid #6366f1', color: '#e2e2f0' }}>
            <p className="font-semibold mb-1" style={{ color: '#a5b4fc' }}>Hi! I'm Crafty 👋</p>
            <p>Try: <em>"Add lead: Juan Santos, birthday June 28"</em></p>
            <button onClick={() => setShowTooltip(false)} className="absolute top-2 right-2 text-xs opacity-40 hover:opacity-100">✕</button>
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 rotate-45" style={{ background: '#1e1e30', borderRight: '1px solid #6366f1', borderBottom: '1px solid #6366f1' }} />
          </div>
        )}
        {/* Button with pulse ring */}
        <div className="relative">
          {showPulse && !open && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: '#6366f1' }} />
          )}
          <button
            onClick={handleOpen}
            className="crafty-fab relative w-12 h-12 md:w-14 md:h-14 text-white rounded-full shadow-lg flex items-center justify-center text-xl md:text-2xl transition-all"
            style={{ background: isCrm && open ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : '#4f46e5' }}
            title="Ask Craft AI"
          >
            {open ? '✕' : '🤖'}
          </button>
        </div>
      </div>

      {/* Chat window — always mounted so CSS transition plays on close */}
      <div
        className="fixed bottom-36 md:bottom-24 right-2 md:right-6 z-50 w-[calc(100vw-16px)] sm:w-80 md:w-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          height: '460px',
          background: 'var(--card)',
          border: '1px solid var(--card-border)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.97)',
          pointerEvents: open ? 'auto' : 'none',
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
              <p className="font-semibold text-sm" style={{ color: '#fff' }}>
                {isCrm ? 'Crafty Assistant' : 'Craft AI'}
              </p>
              <p className="text-xs truncate" style={{ color: 'rgba(199,210,254,0.85)' }}>
                {isCrm ? 'Add leads, log payments, check revenue' : 'Ask anything about your business'}
              </p>
            </div>
            <button
              onClick={() => { setAdvisorMessages([]); setCrmMessages([]); setInput('') }}
              className="text-xs shrink-0"
              style={{ color: 'rgba(199,210,254,0.85)' }}
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
              💬 Ask for Advice
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
              ⚡ Do Something
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
                  {suggestions.map((s, idx) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="crafty-chip-in w-full text-left text-xs px-3 py-2 rounded-lg transition-colors"
                      style={{
                        animationDelay: `${idx * 60}ms`,
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
                  className="crafty-msg-in max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap"
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
                  className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm"
                  style={{ background: 'var(--subtle-bg)', color: 'var(--text-faint)', border: '1px solid var(--card-border)' }}
                >
                  <span className="crafty-dot" style={{ animationDelay: '0ms' }} />
                  <span className="crafty-dot" style={{ animationDelay: '160ms' }} />
                  <span className="crafty-dot" style={{ animationDelay: '320ms' }} />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Paste DM panel — CRM mode only */}
          {isCrm && pasteOpen && (
            <div className="border-t px-3 py-3 space-y-2" style={{ borderColor: 'var(--card-border)', background: 'var(--subtle-bg)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                📋 Paste the client's DM — Crafty will extract details and create the lead.
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={3}
                placeholder={'e.g. "Hi! Available ba kayo July 20? Birthday ng anak ko, mga 80 guests, photobooth lang."'}
                className="w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={submitPaste}
                  disabled={loading || !pasteText.trim()}
                  className="flex-1 text-xs py-2 rounded-xl font-semibold text-white disabled:opacity-40 transition-all"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  Create Lead from DM
                </button>
                <button
                  onClick={() => { setPasteOpen(false); setPasteText('') }}
                  className="text-xs px-3 py-2 rounded-xl"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div
            className="border-t px-3 py-2 flex gap-2 items-end"
            style={{ borderColor: 'var(--card-border)' }}
          >
            {isCrm && !pasteOpen && (
              <button
                onClick={() => setPasteOpen(true)}
                title="Paste a client DM"
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm transition-all"
                style={{ border: '1px solid var(--card-border)', color: 'var(--text-muted)', background: 'var(--subtle-bg)' }}
              >
                📋
              </button>
            )}
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
    </>
  )
}
