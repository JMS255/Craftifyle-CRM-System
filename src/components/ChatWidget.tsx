'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Draft a follow-up message for a client who went quiet',
  'Client says mahal, how do I respond?',
  'What package for 200 pax wedding?',
  'How do I ask for the event details naturally?',
]

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

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

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: updated }),
    })
    const data = await res.json()
    setMessages([...updated, {
      role: 'assistant',
      content: data.error ? `Error: ${data.error}` : data.reply,
    }])
    setLoading(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating button — sits above bottom nav on mobile */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-12 h-12 md:w-14 md:h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center text-xl md:text-2xl transition-all"
        title="Ask Craft AI"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-36 md:bottom-24 right-2 md:right-6 z-50 w-[calc(100vw-16px)] sm:w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: '420px' }}>

          {/* Header */}
          <div className="bg-indigo-600 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-base">🤖</div>
            <div>
              <p className="text-white font-semibold text-sm">Craft AI</p>
              <p className="text-indigo-200 text-xs">Your Craftifyle assistant</p>
            </div>
            <button
              onClick={() => { setMessages([]); setInput('') }}
              className="ml-auto text-indigo-200 hover:text-white text-xs"
              title="Clear chat"
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div>
                <p className="text-xs text-gray-400 text-center mb-3">
                  Ask me anything about your business 👇
                </p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 text-gray-600 hover:text-indigo-700 px-3 py-2 rounded-lg transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-400 text-sm px-4 py-2 rounded-2xl rounded-bl-sm">
                  Typing…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2 flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              placeholder="Ask Craft anything…"
              className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-24"
              style={{ lineHeight: '1.4' }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  )
}
