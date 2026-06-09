'use client'

import { useState, useEffect, useRef } from 'react'
import { auth, getAllDocs, addDocumentWithId, updateDocument } from '@/lib/firebase'

const BUSINESS_TYPES = [
  { id: 'photobooth',    label: '📸 Photobooth' },
  { id: 'printing',      label: '🖨️ Printing' },
  { id: 'travel',        label: '✈️ Travel & Tours' },
  { id: 'design',        label: '🎨 Graphic Design' },
  { id: 'catering',      label: '🍽️ Catering' },
  { id: 'beauty',        label: '💆 Beauty & Wellness' },
  { id: 'other',         label: '📦 Other' },
]

const SOURCES = [
  { id: 'facebook_group', label: 'FB Group' },
  { id: 'referral',       label: 'Referral' },
  { id: 'ad',             label: 'Ad' },
  { id: 'google',         label: 'Google' },
  { id: 'other',          label: 'Other' },
]

const REVEAL_LINES = [
  { key: 'name',    prefix: 'Nakita: ',   delay: 400 },
  { key: 'event',   prefix: 'Event: ',    delay: 900 },
  { key: 'date',    prefix: 'Date: ',     delay: 1400 },
  { key: 'venue',   prefix: 'Venue: ',    delay: 1900 },
]

interface ExtractedLead {
  name?: string
  event?: string
  date?: string
  venue?: string
}

export default function OnboardingModal() {
  const [screen, setScreen] = useState<1 | 2 | 3>(1)
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Screen 1
  const [dm, setDm] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedLead | null>(null)
  const [visibleLines, setVisibleLines] = useState<number>(0)
  const [celebrated, setCelebrated] = useState(false)
  const [s1Error, setS1Error] = useState('')

  // Screen 2
  const [fullName, setFullName] = useState('')
  const [bizName, setBizName] = useState('')
  const [bizType, setBizType] = useState('')
  const [source, setSource] = useState('')
  const [fieldStep, setFieldStep] = useState(0)
  const nameRef = useRef<HTMLInputElement>(null)

  // Screen 3
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    setUserId(uid)
    getAllDocs<{ id: string; onboarding_completed?: boolean }>('profiles').then(profiles => {
      const profile = profiles.find(p => p.id === uid)
      if (!profile?.onboarding_completed) setOpen(true)
    })
  }, [])

  // Staggered reveal after extraction
  useEffect(() => {
    if (!extracted) return
    setVisibleLines(0)
    REVEAL_LINES.forEach((_, i) => {
      setTimeout(() => setVisibleLines(v => v + 1), _.delay)
    })
    setTimeout(() => setCelebrated(true), 2400)
  }, [extracted])

  // Advance field steps in screen 2
  useEffect(() => {
    if (screen === 2) {
      setTimeout(() => setFieldStep(1), 100)
      if (fullName) setTimeout(() => setFieldStep(f => Math.max(f, 2)), 300)
    }
  }, [screen])

  useEffect(() => {
    if (fieldStep === 1) nameRef.current?.focus()
  }, [fieldStep])

  async function handlePasteDM() {
    if (!dm.trim()) { setS1Error('Paste a client message first.'); return }
    setS1Error('')
    setLoading(true)
    try {
      const res = await fetch('/api/crafty-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Parse this DM and create a lead: ${dm}` }],
        }),
      })
      const data = await res.json()
      // Parse what Crafty echoed back — best-effort extraction for the reveal
      const text: string = data.reply ?? ''
      const nameMatch = text.match(/\b([A-Z][a-z]+ [A-Z][a-z]+|[A-Z][a-z]+)\b/)
      const eventMatch = text.match(/birthday|wedding|debut|corporate|reunion|baptism/i)
      const dateMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}|\d{4}-\d{2}-\d{2}/i)
      const venueMatch = text.match(/(?:at|venue[:\s]+|in )([A-Z][^.,\n]{3,30})/i)
      setExtracted({
        name:  nameMatch?.[0] ?? 'Lead',
        event: eventMatch?.[0] ?? 'Event',
        date:  dateMatch?.[0] ?? 'TBD',
        venue: venueMatch?.[1]?.trim() ?? 'TBD',
      })
    } catch {
      setS1Error('Something went wrong. Try again.')
    }
    setLoading(false)
  }

  async function finish() {
    if (!userId) return
    setClosing(true)
    const profiles = await getAllDocs<{ id: string }>('profiles')
    const profileExists = profiles.some(p => p.id === userId)
    const profileData = {
      onboarding_completed: true,
      ...(bizType ? { business_type: bizType } : {}),
      ...(source  ? { acquisition_source: source } : {}),
      ...(fullName ? { full_name: fullName } : {}),
      ...(bizName  ? { business_name: bizName } : {}),
    }
    if (profileExists) {
      await updateDocument('profiles', userId, profileData)
    } else {
      await addDocumentWithId('profiles', userId, { ...profileData, user_id: userId, email: auth.currentUser?.email ?? '' })
    }
    setTimeout(() => { setOpen(false); setClosing(false) }, 400)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
               transition: 'opacity 0.4s', opacity: closing ? 0 : 1 }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
      >
        {/* ── Screen 1: Paste DM ── */}
        {screen === 1 && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>C</div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                Crafty CRM
              </span>
            </div>

            {!extracted ? (
              <>
                <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-heading)' }}>
                  Subukan natin! 👋
                </h2>
                <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                  I-paste ang isang client DM — bibigyan kita ng demo kung gaano kabilis mag-create ng lead si Crafty.
                </p>
                <textarea
                  value={dm}
                  onChange={e => setDm(e.target.value)}
                  placeholder={'"Hi! Available ba kayo July 20? Birthday ng anak ko, 80 guests, sa Zamboanga City. Magkano package?"'}
                  rows={4}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none mb-3"
                  style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)',
                           color: 'var(--text-heading)', outline: 'none' }}
                />
                {s1Error && <p className="text-xs mb-3" style={{ color: 'var(--danger)' }}>{s1Error}</p>}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePasteDM}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                  >
                    {loading ? 'Binabasa ni Crafty…' : '✨ Let Crafty read it'}
                  </button>
                  <button onClick={() => setScreen(2)}
                    className="text-sm px-4 py-2.5 rounded-[10px]"
                    style={{ color: 'var(--text-faint)', border: '1px solid var(--card-border)' }}>
                    Skip
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-heading)' }}>
                  Binabasa ni Crafty…
                </h2>
                <div className="rounded-xl p-4 mb-4 space-y-2"
                  style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)' }}>
                  {REVEAL_LINES.map((line, i) => (
                    <div key={line.key}
                      style={{ transition: 'opacity 0.4s, transform 0.4s',
                               opacity: visibleLines > i ? 1 : 0,
                               transform: visibleLines > i ? 'translateY(0)' : 'translateY(6px)' }}>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-faint)' }}>
                        {line.prefix}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                        {extracted[line.key as keyof ExtractedLead]}
                      </span>
                    </div>
                  ))}
                </div>
                {celebrated && (
                  <div style={{ transition: 'opacity 0.5s', opacity: celebrated ? 1 : 0 }}>
                    <div className="rounded-xl px-4 py-3 mb-4 text-sm font-medium"
                      style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-text)',
                               border: '1px solid rgba(99,102,241,0.2)' }}>
                      🎉 Na-save na sa leads! Ganyan kabilis.
                    </div>
                    <button onClick={() => setScreen(2)}
                      className="w-full py-2.5 rounded-[10px] text-sm font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                      Susunod →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Screen 2: Profile setup ── */}
        {screen === 2 && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>C</div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
                Grabe 'di ba? 😄
              </span>
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-heading)' }}>
              Ilang tanong lang…
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Para ma-personalize ang CRM mo.
            </p>

            <div className="space-y-4">
              {/* Name */}
              <div style={{ transition: 'opacity 0.35s, transform 0.35s',
                            opacity: fieldStep >= 1 ? 1 : 0,
                            transform: fieldStep >= 1 ? 'translateY(0)' : 'translateY(8px)' }}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-faint)' }}>
                  Ano pangalan mo?
                </label>
                <input
                  ref={nameRef}
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); if (e.target.value) setFieldStep(f => Math.max(f, 2)) }}
                  placeholder="Juan dela Cruz"
                  className="w-full rounded-xl px-4 py-2.5 text-sm"
                  style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)',
                           color: 'var(--text-heading)', outline: 'none' }}
                />
              </div>

              {/* Business name */}
              <div style={{ transition: 'opacity 0.35s 0.1s, transform 0.35s 0.1s',
                            opacity: fieldStep >= 2 ? 1 : 0,
                            transform: fieldStep >= 2 ? 'translateY(0)' : 'translateY(8px)' }}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-faint)' }}>
                  Ano pangalan ng business mo?
                </label>
                <input
                  value={bizName}
                  onChange={e => { setBizName(e.target.value); if (e.target.value) setFieldStep(f => Math.max(f, 3)) }}
                  placeholder="Juan's Photobooth"
                  className="w-full rounded-xl px-4 py-2.5 text-sm"
                  style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)',
                           color: 'var(--text-heading)', outline: 'none' }}
                />
              </div>

              {/* Business type */}
              <div style={{ transition: 'opacity 0.35s 0.2s, transform 0.35s 0.2s',
                            opacity: fieldStep >= 3 ? 1 : 0,
                            transform: fieldStep >= 3 ? 'translateY(0)' : 'translateY(8px)' }}>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-faint)' }}>
                  Anong klase ng business?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_TYPES.map((bt, i) => (
                    <button key={bt.id} onClick={() => { setBizType(bt.id); setFieldStep(f => Math.max(f, 4)) }}
                      className="text-left px-3 py-2 rounded-xl text-sm transition-all"
                      style={{
                        transitionDelay: `${i * 50}ms`,
                        background: bizType === bt.id ? 'rgba(99,102,241,0.15)' : 'var(--subtle-bg)',
                        border: `1px solid ${bizType === bt.id ? 'rgba(99,102,241,0.4)' : 'var(--card-border)'}`,
                        color: bizType === bt.id ? 'var(--accent-text)' : 'var(--text-muted)',
                        fontWeight: bizType === bt.id ? 600 : 400,
                      }}>
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source */}
              <div style={{ transition: 'opacity 0.35s 0.1s, transform 0.35s 0.1s',
                            opacity: fieldStep >= 4 ? 1 : 0,
                            transform: fieldStep >= 4 ? 'translateY(0)' : 'translateY(8px)' }}>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-faint)' }}>
                  Paano mo nalaman ang Crafty CRM?
                </label>
                <div className="flex flex-wrap gap-2">
                  {SOURCES.map(s => (
                    <button key={s.id} onClick={() => setSource(s.id)}
                      className="px-3 py-1.5 rounded-full text-xs transition-all"
                      style={{
                        background: source === s.id ? 'rgba(99,102,241,0.15)' : 'var(--subtle-bg)',
                        border: `1px solid ${source === s.id ? 'rgba(99,102,241,0.4)' : 'var(--card-border)'}`,
                        color: source === s.id ? 'var(--accent-text)' : 'var(--text-muted)',
                        fontWeight: source === s.id ? 600 : 400,
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setScreen(3)}
              disabled={!fullName}
              className="w-full mt-6 py-2.5 rounded-[10px] text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              Handa na! →
            </button>
          </div>
        )}

        {/* ── Screen 3: Launch ── */}
        {screen === 3 && (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>
              Handa na ang{bizType
                ? ` ${BUSINESS_TYPES.find(b => b.id === bizType)?.label ?? ''}`
                : ''} CRM mo!
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              {fullName ? `Welcome, ${fullName.split(' ')[0]}! ` : ''}
              Lahat ay naka-set up na. Simulan na natin.
            </p>

            {/* Blurred dashboard preview */}
            <div className="relative rounded-xl overflow-hidden mb-6"
              style={{ height: '120px', background: 'var(--subtle-bg)', border: '1px solid var(--card-border)' }}>
              <div className="absolute inset-0 flex flex-col gap-2 p-3" style={{ filter: 'blur(3px)', opacity: 0.5 }}>
                <div className="h-4 rounded-lg w-1/3" style={{ background: 'var(--card-border)' }} />
                <div className="flex gap-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex-1 h-14 rounded-xl" style={{ background: 'var(--card-border)' }} />
                  ))}
                </div>
                <div className="h-4 rounded-lg w-2/3" style={{ background: 'var(--card-border)' }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-text)',
                           border: '1px solid rgba(99,102,241,0.3)' }}>
                  Dashboard mo 👆
                </span>
              </div>
            </div>

            <button onClick={finish}
              className="w-full py-3 rounded-[10px] text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              Puntahan na ang Dashboard 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
