'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    business_name: '',
    location: '',
  })

  useEffect(() => {
    const db = createClient()
    db.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return }
      setEmail(data.user.email ?? '')
      const { data: profile } = await db
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle()
      if (profile) {
        setForm({
          full_name: profile.full_name ?? '',
          business_name: profile.business_name ?? '',
          location: profile.location ?? '',
        })
      }
      setLoading(false)
    })
  }, [router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return

    const { error: err } = await db.from('profiles').upsert({
      id: user.id,
      full_name: form.full_name.trim() || null,
      business_name: form.business_name.trim() || null,
      location: form.location.trim() || null,
    })

    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)

    // Trigger sidebar to refresh
    window.dispatchEvent(new Event('profile-updated'))
  }

  const initials = form.full_name
    ? form.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : email[0]?.toUpperCase() ?? '?'

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

  return (
    <div className="p-4 md:p-8 max-w-lg">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Profile</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>
          How you appear in Crafty CRM
        </p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {initials}
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>
            {form.full_name || 'Your Name'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>{email}</p>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl p-6 space-y-5"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
      >
        {/* Full name */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Full Name
          </label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="e.g. Maria Santos"
            className="w-full rounded-xl px-4 py-2.5 text-sm"
          />
        </div>

        {/* Business name */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Business Name
          </label>
          <input
            type="text"
            value={form.business_name}
            onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
            placeholder="e.g. Maria's Events"
            className="w-full rounded-xl px-4 py-2.5 text-sm"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            City / Location
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Zamboanga City"
            className="w-full rounded-xl px-4 py-2.5 text-sm"
          />
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Email <span style={{ color: 'var(--text-faint)' }}>(cannot be changed)</span>
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full rounded-xl px-4 py-2.5 text-sm opacity-50 cursor-not-allowed"
          />
        </div>

        {error && (
          <div
            className="text-xs rounded-xl px-4 py-2.5"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
