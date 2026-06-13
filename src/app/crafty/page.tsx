'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import type { AiPdf, AiSettings, AiTone } from '@/types'
import WelcomeCard from '@/components/WelcomeCard'

const TONE_OPTIONS: { value: AiTone; label: string; desc: string }[] = [
  { value: 'casual_taglish', label: 'Casual Taglish', desc: 'Warm, uses "po", mix of Filipino & English' },
  { value: 'casual_english', label: 'Casual English', desc: 'Friendly and approachable' },
  { value: 'formal_english', label: 'Formal English', desc: 'Professional and precise' },
]

const DEFAULT_FORM: AiSettings = {
  business_name: '', business_description: '', pricing_model: '',
  ai_rules: '', ai_tone: 'casual_taglish', ai_context: '', ai_pdfs: [],
}

function isConfigured(form: AiSettings) {
  return !!(form.business_description?.trim() || form.pricing_model?.trim())
}

export default function CraftyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<AiSettings>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ text: string; type: 'error' | 'warn' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const user = auth.currentUser
    if (!user) { router.replace('/login'); return }
    getDoc(doc(db, 'profiles', user.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setForm({
          business_name: d.business_name ?? '',
          business_description: d.business_description ?? '',
          pricing_model: d.pricing_model ?? '',
          ai_rules: d.ai_rules ?? '',
          ai_tone: d.ai_tone ?? 'casual_taglish',
          ai_context: d.ai_context ?? '',
          ai_pdfs: d.ai_pdfs ?? [],
        })
      }
      setLoading(false)
    })
  }, [router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const user = auth.currentUser
    if (!user) return
    setSaving(true)
    await setDoc(doc(db, 'profiles', user.uid), form, { merge: true })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  // Test panel
  const [testMessages, setTestMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [testInput, setTestInput] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const testBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    testBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [testMessages])

  const sendTest = useCallback(async (text?: string) => {
    const content = (text ?? testInput).trim()
    if (!content || testLoading) return
    setTestInput('')
    const updated = [...testMessages, { role: 'user' as const, content }]
    setTestMessages(updated)
    setTestLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      const data = await res.json()
      setTestMessages([...updated, { role: 'assistant', content: data.reply ?? data.error ?? 'No response.' }])
    } catch {
      setTestMessages([...updated, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setTestLoading(false)
  }, [testInput, testLoading, testMessages])

  const MAX_PDFS = 5

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return

    const user = auth.currentUser
    if (!user) return

    const currentCount = form.ai_pdfs?.length ?? 0
    const slots = MAX_PDFS - currentCount
    if (slots <= 0) { setUploadMsg({ text: `Limit reached — max ${MAX_PDFS} PDFs.`, type: 'error' }); return }

    const toUpload = files.slice(0, slots)
    if (files.length > slots) setUploadMsg({ text: `Only ${slots} slot${slots !== 1 ? 's' : ''} left — uploading first ${slots}.`, type: 'warn' })
    else setUploadMsg(null)

    setUploading(true)
    const warnings: string[] = []

    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i]
      if (toUpload.length > 1) setUploadMsg({ text: `Uploading ${i + 1} of ${toUpload.length}…`, type: 'warn' })

      if (file.type !== 'application/pdf') { warnings.push(`"${file.name}" skipped — not a PDF.`); continue }
      if (file.size > 4 * 1024 * 1024) { warnings.push(`"${file.name}" skipped — over 4 MB.`); continue }

      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/profile/parse-pdf', { method: 'POST', body })
      const data = await res.json()

      if (!res.ok) { warnings.push(`"${file.name}" failed — ${data.error ?? 'unknown error'}.`); continue }
      if (data.truncated) warnings.push(`"${file.name}" is large — only the first ~40,000 characters were saved.`)

      const newPdf: AiPdf = { name: data.name, text: data.text }
      setForm(f => {
        const updated = { ...f, ai_pdfs: [...(f.ai_pdfs ?? []), newPdf] }
        setDoc(doc(db, 'profiles', user.uid), { ai_pdfs: updated.ai_pdfs }, { merge: true })
        return updated
      })
    }

    setUploading(false)
    setUploadMsg(warnings.length ? { text: warnings.join(' '), type: 'warn' } : null)
  }

  async function removePdf(idx: number) {
    const user = auth.currentUser
    if (!user) return
    setForm(f => {
      const updated = { ...f, ai_pdfs: f.ai_pdfs?.filter((_, i) => i !== idx) ?? [] }
      setDoc(doc(db, 'profiles', user.uid), { ai_pdfs: updated.ai_pdfs }, { merge: true })
      return updated
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3" style={{ color: 'var(--text-faint)' }}>
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#6366f1' }} />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  const configured = isConfigured(form)
  const pdfCount = form.ai_pdfs?.length ?? 0

  return (
    <div className="p-4 md:p-8">

      {/* Header banner */}
      <div
        className="relative rounded-2xl p-6 mb-8 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #6d28d9 100%)' }}
      >
        {/* Decorative glow blobs */}
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
        <div className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent)' }} />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⚡</span>
              <h1 className="text-xl font-bold" style={{ color: '#fff' }}>Crafty AI</h1>
            </div>
            <p className="text-sm max-w-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Train Crafty for your business — any industry. The more you tell it, the better it replies.
            </p>
          </div>

          {/* Save button / status pill */}
          <div className="shrink-0 mt-1">
            <button
              type="submit"
              form="crafty-form"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-60"
              style={saved
                ? { background: 'rgba(16,185,129,0.25)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }
                : { background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }
              }
            >
              {saving ? '…' : saved
                ? <><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#6ee7b7' }} />Saved</>
                : <><span className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.6)' }} />{configured ? 'Save changes' : 'Save'}</>
              }
            </button>
          </div>
        </div>

        {/* Stats row */}
        {(configured || pdfCount > 0) && (
          <div className="relative flex items-center gap-4 mt-4 pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            {form.business_name && (
              <div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Business</p>
                <p className="text-sm font-medium truncate max-w-[140px]" style={{ color: '#fff' }}>{form.business_name}</p>
              </div>
            )}
            {form.ai_tone && (
              <div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Tone</p>
                <p className="text-sm font-medium" style={{ color: '#fff' }}>
                  {TONE_OPTIONS.find(o => o.value === form.ai_tone)?.label ?? '—'}
                </p>
              </div>
            )}
            {pdfCount > 0 && (
              <div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Documents</p>
                <p className="text-sm font-medium" style={{ color: '#fff' }}>{pdfCount} PDF{pdfCount !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <WelcomeCard
        storageKey="welcome-crafty"
        icon="⚡"
        title="Train Your AI Assistant"
        description="Teach Crafty about your business so it can reply to clients in your voice — automatically."
        tips={[
          'Fill in Business Training so Crafty knows your packages and pricing',
          'Upload PDF brochures or rate sheets for richer context',
          'Use Test Your Training to preview how Crafty replies before going live',
        ]}
        accentColor="#7c3aed"
      />

      <form id="crafty-form" onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-start">

          {/* Left column — Business Training */}
          <div className="space-y-6">
            <div>
              <p className="section-label mb-4">Business Training</p>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
              >
                {/* Business Name */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <label className="block text-xs font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    Business Name
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-faint)' }}>How Crafty will refer to your business in replies</p>
                  <input className="w-full rounded-xl px-4 py-2.5 text-sm"
                    placeholder="e.g. Laagan Adventure Tours"
                    value={form.business_name ?? ''}
                    onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} />
                </div>

                {/* What you offer */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <label className="block text-xs font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    What you offer
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-faint)' }}>Describe your services so Crafty can explain them to clients</p>
                  <textarea rows={3} className="w-full rounded-xl px-4 py-2.5 text-sm resize-none"
                    placeholder="e.g. Day tours, island hopping, group packages around Zamboanga peninsula"
                    value={form.business_description ?? ''}
                    onChange={e => setForm(f => ({ ...f, business_description: e.target.value }))} />
                </div>

                {/* Pricing */}
                <div className="px-5 py-4">
                  <label className="block text-xs font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    How you price
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-faint)' }}>Rates, minimums, or packages — Crafty will quote from this</p>
                  <textarea rows={2} className="w-full rounded-xl px-4 py-2.5 text-sm resize-none"
                    placeholder="e.g. ₱500/head, minimum 4 pax. Custom group quotes on request."
                    value={form.pricing_model ?? ''}
                    onChange={e => setForm(f => ({ ...f, pricing_model: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Reply Tone */}
            <div>
              <p className="section-label mb-4">Reply Tone</p>
              <div className="grid grid-cols-1 gap-2">
                {TONE_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, ai_tone: o.value }))}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                    style={{
                      background: form.ai_tone === o.value ? 'var(--accent-subtle)' : 'var(--card)',
                      border: form.ai_tone === o.value ? '1.5px solid var(--accent)' : '1px solid var(--card-border)',
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                      style={{
                        borderColor: form.ai_tone === o.value ? 'var(--accent)' : 'var(--card-border)',
                        background: form.ai_tone === o.value ? 'var(--accent)' : 'transparent',
                      }}
                    >
                      {form.ai_tone === o.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{o.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{o.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — Rules + Knowledge Base */}
          <div className="space-y-6">

            {/* Rules & Context */}
            <div>
              <p className="section-label mb-4">Rules & Context</p>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
              >
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                  <label className="block text-xs font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    Rules for Crafty
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-faint)' }}>Crafty will follow these strictly every time it replies</p>
                  <textarea rows={3} className="w-full rounded-xl px-4 py-2.5 text-sm resize-none"
                    placeholder="e.g. Always ask group size first. Never quote without asking the event date."
                    value={form.ai_rules ?? ''}
                    onChange={e => setForm(f => ({ ...f, ai_rules: e.target.value }))} />
                </div>

                <div className="px-5 py-4">
                  <label className="block text-xs font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    Extra context <span className="font-normal" style={{ color: 'var(--text-faint)' }}>(optional)</span>
                  </label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-faint)' }}>FAQs, policies, or common objections Crafty should know</p>
                  <textarea rows={3} className="w-full rounded-xl px-4 py-2.5 text-sm resize-none"
                    placeholder="e.g. We don't do cash on delivery. Booking requires a 30% downpayment."
                    value={form.ai_context ?? ''}
                    onChange={e => setForm(f => ({ ...f, ai_context: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Knowledge Base */}
            <div>
              <p className="section-label mb-4">Knowledge Base</p>
              <div
                className="rounded-2xl"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
              >
                {/* File list */}
                {pdfCount > 0 && (
                  <div style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                    {form.ai_pdfs!.map((pdf, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-5 py-3"
                        style={{ borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: 'var(--accent-subtle)' }}>
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                              style={{ color: 'var(--accent-text)' }}>
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{pdf.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                              {(pdf.text.length / 1000).toFixed(1)}k characters extracted
                            </p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removePdf(i)}
                          className="text-xs px-2.5 py-1.5 rounded-lg shrink-0 font-medium"
                          style={{ color: 'var(--danger)', background: 'var(--danger-muted)' }}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload zone */}
                <div className="p-5">
                  {pdfCount === 0 && (
                    <p className="text-xs mb-4 text-center" style={{ color: 'var(--text-faint)' }}>
                      No documents yet. Upload your brochure, rate sheet, or FAQ and Crafty will read it when answering clients.
                    </p>
                  )}
                  <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleUpload} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || pdfCount >= MAX_PDFS}
                    className="w-full py-4 rounded-xl text-sm font-medium border-2 border-dashed transition-all disabled:opacity-50 flex flex-col items-center gap-1.5"
                    style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}
                  >
                    {uploading ? (
                      <>
                        <span className="text-base">⏳</span>
                        <span>Extracting text…</span>
                      </>
                    ) : (
                      <>
                        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        <span>Upload PDF</span>
                        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Up to {MAX_PDFS} PDFs · 4 MB each</span>
                      </>
                    )}
                  </button>

                  {uploadMsg && (
                    <p className="text-xs mt-3 text-center"
                      style={{ color: uploadMsg.type === 'error' ? 'var(--danger)' : 'var(--warning)' }}>
                      {uploadMsg.text}
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>
          {/* Test Panel — 3rd column on XL */}
          <div className="xl:col-span-1 lg:col-span-2 xl:sticky xl:top-8">
            <p className="section-label mb-4">Test Your Training</p>
            <div
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{ background: 'var(--card)', border: '1px solid var(--card-border)', height: '480px' }}
            >
              {/* Panel header */}
              <div className="px-4 py-3 flex items-center justify-between shrink-0"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                    style={{ background: 'rgba(255,255,255,0.2)' }}>🤖</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#fff' }}>Crafty Preview</p>
                    <p className="text-xs" style={{ color: 'rgba(199,210,254,0.85)' }}>Uses your saved training</p>
                  </div>
                </div>
                <button type="button" onClick={() => setTestMessages([])}
                  className="text-xs" style={{ color: 'rgba(199,210,254,0.85)' }}>
                  Clear
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {testMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                    <span className="text-3xl">⚡</span>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Ask Crafty anything</p>
                    <p className="text-xs max-w-[200px]" style={{ color: 'var(--text-faint)' }}>
                      Test how Crafty replies using your saved training. Save your changes first.
                    </p>
                    <div className="space-y-2 w-full mt-2">
                      {['What services do you offer?', 'How much does it cost?', 'How do I book?'].map(q => (
                        <button key={q} type="button" onClick={() => sendTest(q)}
                          className="w-full text-left text-xs px-3 py-2 rounded-lg transition-colors"
                          style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {testMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap"
                      style={m.role === 'user'
                        ? { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', borderBottomRightRadius: 4 }
                        : { background: 'var(--subtle-bg)', color: 'var(--text-heading)', border: '1px solid var(--card-border)', borderBottomLeftRadius: 4 }
                      }>
                      {m.content}
                    </div>
                  </div>
                ))}
                {testLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-sm"
                      style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)' }}>
                      <span className="crafty-dot" style={{ animationDelay: '0ms' }} />
                      <span className="crafty-dot" style={{ animationDelay: '160ms' }} />
                      <span className="crafty-dot" style={{ animationDelay: '320ms' }} />
                    </div>
                  </div>
                )}
                <div ref={testBottomRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-2 flex gap-2 items-end shrink-0"
                style={{ borderTop: '1px solid var(--card-border)' }}>
                <textarea
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTest() } }}
                  rows={1}
                  placeholder="Ask anything…"
                  className="flex-1 resize-none rounded-xl px-3 py-2 text-sm focus:outline-none max-h-20"
                  style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)', lineHeight: '1.4' }}
                />
                <button type="button" onClick={() => sendTest()}
                  disabled={testLoading || !testInput.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white disabled:opacity-40 transition-all"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                  ↑
                </button>
              </div>
            </div>

          </div>

        </div>

      </form>
    </div>
  )
}
