'use client'

import { useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const CHIPS = [
  'spent 200 food today',
  'bayad na camera july',
  'earned 3000 from booking',
  'GCash ko ay 8450 na',
  'nangutang 5k kay Kuya, 1k/mo 5 months',
  'natanggap ko na ang CHED',
]

function imageToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve({ data: base64, mimeType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function FinanceAIInput({ onRefresh }: { onRefresh?: () => void }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Message[]>([])
  const [pendingImage, setPendingImage] = useState<{ data: string; mimeType: string; previewUrl: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.length, loading])

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const { data, mimeType } = await imageToBase64(file)
    const previewUrl = URL.createObjectURL(file)
    setPendingImage({ data, mimeType, previewUrl })
    e.target.value = ''
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if ((!msg && !pendingImage) || loading) return
    setInput('')
    setLoading(true)

    const displayText = msg || '📷 Screenshot sent'
    const newHistory: Message[] = [...history, { role: 'user', content: displayText }]
    setHistory(newHistory)

    const imageToSend = pendingImage
    setPendingImage(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000)
    try {
      const res = await fetch('/api/personal-finance-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          ...(imageToSend ? { imageData: imageToSend.data, imageMimeType: imageToSend.mimeType } : {}),
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      setHistory(h => [...h, { role: 'assistant', content: data.reply ?? 'Done.' }])
      onRefresh?.()
    } catch (err) {
      const errMsg = err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out. Try again.'
        : 'Something went wrong. Please try again.'
      setHistory(h => [...h, { role: 'assistant', content: errMsg }])
    } finally {
      clearTimeout(timeoutId)
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ background: 'var(--card-elevated)', border: '1px solid var(--card-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">✨</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--accent-text)' }}>Crafty AI</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--success-muted)', color: 'var(--success)', fontSize: '10px' }}>📷 reads screenshots</span>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ color: 'var(--text-faint)', background: 'var(--card-bg)' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages or chips */}
      <div className="overflow-y-auto" style={{ maxHeight: history.length ? '260px' : 'none' }}>
        {history.length === 0 ? (
          <div className="px-3 pt-3 pb-1">
            <p className="text-xs mb-2" style={{ color: 'var(--text-faint)' }}>Type a message or upload a GCash/bank screenshot:</p>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  className="text-xs px-2.5 py-1.5 rounded-full font-medium"
                  style={{
                    background: 'var(--card-bg)',
                    color: 'var(--text-body)',
                    border: '1px solid var(--card-border)',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-3 py-3 space-y-2">
            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug"
                  style={msg.role === 'user'
                    ? { background: 'var(--accent)', color: '#fff', borderBottomRightRadius: '4px' }
                    : { background: 'var(--card-bg)', color: 'var(--text-body)', border: '1px solid var(--card-border)', borderBottomLeftRadius: '4px' }
                  }
                >
                  {msg.content.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</span>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-4 py-3 flex gap-1 items-center"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderBottomLeftRadius: '4px' }}
                >
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: 'var(--accent)', animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Image preview */}
      {pendingImage && (
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderTop: '1px solid var(--card-border)' }}>
          <img src={pendingImage.previewUrl} alt="preview" className="h-14 w-14 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: 'var(--text-heading)' }}>Screenshot ready</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Add a note or just tap Send</p>
          </div>
          <button onClick={() => setPendingImage(null)} className="text-xs p-1" style={{ color: 'var(--text-faint)' }}>✕</button>
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderTop: '1px solid var(--card-border)' }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 disabled:opacity-40"
          style={{ background: pendingImage ? 'var(--success-muted)' : 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          title="Upload GCash / bank screenshot"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pendingImage ? 'var(--success)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={pendingImage ? 'Add a note (optional)…' : 'Type in Filipino or English…'}
          className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{
            background: 'var(--card-bg)',
            color: 'var(--text-body)',
            border: '1px solid var(--card-border)',
          }}
          disabled={loading}
        />
        <button
          onClick={() => send()}
          disabled={(!input.trim() && !pendingImage) || loading}
          className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 disabled:opacity-40 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
