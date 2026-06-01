'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { EventType, LeadSource } from '@/types'

const EVENT_TYPES: EventType[] = [
  'wedding', 'birthday', 'debut', 'corporate', 'christmas_party',
  'reunion', 'baptism', 'other',
]

const SOURCES: LeadSource[] = [
  'facebook', 'instagram', 'referral', 'walk-in', 'website', 'tiktok', 'other',
]

export default function NewLeadPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showMore, setShowMore] = useState(false)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    facebook: '',
    event_type: '' as EventType | '',
    event_date: '',
    venue: '',
    guest_count: '',
    package: '',
    budget: '',
    source: 'facebook' as LeadSource,
    notes: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError('')

    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    const { data, error: err } = await db
      .from('leads')
      .insert({
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        facebook: form.facebook || null,
        event_type: form.event_type || null,
        event_date: form.event_date || null,
        venue: form.venue || null,
        guest_count: form.guest_count ? parseInt(form.guest_count) : null,
        package: form.package || null,
        budget: form.budget ? parseFloat(form.budget) : null,
        source: form.source,
        notes: form.notes || null,
        status: 'new',
        user_id: user?.id,
      })
      .select()
      .single()

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    router.push(`/leads/${data.id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/leads" className="text-sm text-indigo-600 hover:underline">
          ← Back to Leads
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">New Lead</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        {/* Core fields — always visible */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Name <span className="text-red-400">*</span>
          </label>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Maria Santos" autoFocus
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }} />
        </div>
        <Field label="Phone / Contact" value={form.phone} onChange={(v) => set('phone', v)} placeholder="09XXXXXXXXX or Facebook name" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Event Type</label>
            <select value={form.event_type} onChange={(e) => set('event_type', e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}>
              <option value="">Select…</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
          </div>
          <Field label="Event Date" value={form.event_date} onChange={(v) => set('event_date', v)} type="date" />
        </div>

        {/* Expandable extra fields */}
        {showMore && (
          <div className="space-y-4 pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <Field label="Email" value={form.email} onChange={(v) => set('email', v)} placeholder="maria@email.com" type="email" />
            <Field label="Facebook" value={form.facebook} onChange={(v) => set('facebook', v)} placeholder="@mariaS or facebook.com/maria" />
            <Field label="Venue" value={form.venue} onChange={(v) => set('venue', v)} placeholder="e.g. Grand Astoria Hotel" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Guest Count" value={form.guest_count} onChange={(v) => set('guest_count', v)} placeholder="150" type="number" />
              <Field label="Budget (₱)" value={form.budget} onChange={(v) => set('budget', v)} placeholder="6500" type="number" />
            </div>
            <Field label="Package Interest" value={form.package} onChange={(v) => set('package', v)} placeholder="e.g. Photobooth + Photography" />
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Source</label>
              <select value={form.source} onChange={(e) => set('source', e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}>
                {SOURCES.map(s => <option key={s} value={s}>{s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Notes</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
                placeholder="Any extra details…" className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }} />
            </div>
          </div>
        )}

        <button type="button" onClick={() => setShowMore(v => !v)}
          className="text-xs flex items-center gap-1.5 transition-colors"
          style={{ color: 'var(--text-faint)' }}>
          <span className="text-sm">{showMore ? '▲' : '▼'}</span>
          {showMore ? 'Show less' : '+ Add more details (email, venue, package, notes)'}
        </button>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            {saving ? 'Saving…' : 'Save Lead →'}
          </button>
          <Link href="/leads" className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, placeholder = '', type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }} />
    </div>
  )
}
