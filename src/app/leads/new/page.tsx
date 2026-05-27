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

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Contact Info */}
        <fieldset>
          <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Contact Info
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Maria Santos"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} placeholder="09XXXXXXXXX" />
            <Field label="Email" value={form.email} onChange={(v) => set('email', v)} placeholder="maria@email.com" type="email" />
            <div className="col-span-2">
              <Field label="Facebook" value={form.facebook} onChange={(v) => set('facebook', v)} placeholder="facebook.com/maria or @mariaS" />
            </div>
          </div>
        </fieldset>

        {/* Event Info */}
        <fieldset>
          <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Event Details
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
              <select
                value={form.event_type}
                onChange={(e) => set('event_type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select…</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Event Date" value={form.event_date} onChange={(v) => set('event_date', v)} type="date" />
            <div className="col-span-2">
              <Field label="Venue" value={form.venue} onChange={(v) => set('venue', v)} placeholder="e.g. Grand Astoria Hotel" />
            </div>
            <Field label="Guest Count" value={form.guest_count} onChange={(v) => set('guest_count', v)} placeholder="150" type="number" />
            <Field label="Package" value={form.package} onChange={(v) => set('package', v)} placeholder="e.g. Premium 3 Hours" />
            <Field label="Budget (₱)" value={form.budget} onChange={(v) => set('budget', v)} placeholder="15000" type="number" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={form.source}
                onChange={(e) => set('source', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="Any extra details about this lead…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Lead'}
          </button>
          <Link
            href="/leads"
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  )
}
