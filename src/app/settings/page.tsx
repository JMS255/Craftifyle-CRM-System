'use client'

import { useEffect, useState } from 'react'
import { auth, db, getDocsByUser, addDocument, deleteDocument, collection, query, where, getDocs } from '@/lib/firebase'
import WelcomeCard from '@/components/WelcomeCard'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import type { AiSettings, AiTone } from '@/types'
import TopBar from '@/components/TopBar'

interface Row {
  id?: string
  name: string
  price: string
  description: string
  is_active: boolean
  is_addon: boolean
}

const DEFAULT_BASES: Row[] = [
  { name: 'Photobooth Only', price: '3500', description: '3 hrs, unlimited shots, custom backdrop', is_active: true, is_addon: false },
  { name: 'Photography Only', price: '4500', description: '3 hrs, 300+ edited photos', is_active: true, is_addon: false },
  { name: 'Photobooth + Photography', price: '6500', description: '3 hrs, both services — most popular', is_active: true, is_addon: false },
  { name: 'Premium Bundle', price: '8000', description: '4 hrs, photography + videography, 400+ photos, pre-event shoot', is_active: true, is_addon: false },
]
const DEFAULT_ADDONS: Row[] = [
  { name: 'Extended coverage (+1 hr)', price: '800', description: '', is_active: true, is_addon: true },
  { name: 'Magnet prints (150 pcs)', price: '1500', description: '', is_active: true, is_addon: true },
  { name: 'Custom template design', price: '0', description: 'FREE', is_active: true, is_addon: true },
  { name: '30-sec highlight video', price: '0', description: 'FREE', is_active: true, is_addon: true },
]

function emptyBase(): Row { return { name: '', price: '', description: '', is_active: true, is_addon: false } }
function emptyAddon(): Row { return { name: '', price: '', description: '', is_active: true, is_addon: true } }

export default function SettingsPage() {
  const [bases, setBases] = useState<Row[]>([])
  const [addons, setAddons] = useState<Row[]>([])
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const user = auth.currentUser
      if (!user) return
      const allPkgs = await getDocsByUser<Row & { id: string; user_id: string; sort_order: number }>('packages', user.uid)
      const data = allPkgs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      if (!data || data.length === 0) {
        setBases(DEFAULT_BASES)
        setAddons(DEFAULT_ADDONS)
      } else {
        setBases(data.filter(p => !p.is_addon).map(p => ({ ...p, price: String(p.price) })))
        setAddons(data.filter(p => p.is_addon).map(p => ({ ...p, price: String(p.price) })))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const user = auth.currentUser
      if (!user) return

      const allRows = [
        ...bases.map((r, i) => ({ ...r, sort_order: i, is_addon: false })),
        ...addons.map((r, i) => ({ ...r, sort_order: i, is_addon: true })),
      ].filter(r => r.name.trim())

      // Delete all existing packages for this user
      const existing = await getDocsByUser<{ id: string; user_id: string }>('packages', user.uid)
      await Promise.all(existing.map(p => deleteDocument('packages', p.id)))

      // Re-insert all
      await Promise.all(
        allRows.map((r, i) => addDocument('packages', {
          user_id: user.uid,
          name: r.name.trim(),
          price: parseFloat(r.price) || 0,
          description: r.description?.trim() || null,
          is_addon: r.is_addon,
          is_active: r.is_active,
          sort_order: i,
        }))
      )

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      setDeletedIds([])

      const allPkgs = await getDocsByUser<Row & { id: string; user_id: string; sort_order: number }>('packages', user.uid)
      const fresh = allPkgs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      setBases(fresh.filter(p => !p.is_addon).map(p => ({ ...p, price: String(p.price) })))
      setAddons(fresh.filter(p => p.is_addon).map(p => ({ ...p, price: String(p.price) })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed — try again.')
    } finally {
      setSaving(false)
    }
  }

  function deleteRow(list: Row[], setList: (r: Row[]) => void, idx: number) {
    const row = list[idx]
    if (row.id) setDeletedIds(prev => [...prev, row.id!])
    setList(list.filter((_, i) => i !== idx))
  }

  function updateRow(list: Row[], setList: (r: Row[]) => void, idx: number, field: keyof Row, value: string | boolean) {
    setList(list.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function resetToDefaults() {
    if (!confirm('Reset to default Craftifyle packages? This will overwrite your current list on next save.')) return
    setBases(DEFAULT_BASES.map(r => ({ ...r, id: undefined })))
    setAddons(DEFAULT_ADDONS.map(r => ({ ...r, id: undefined })))
    setDeletedIds([...bases.filter(r => r.id).map(r => r.id!), ...addons.filter(r => r.id).map(r => r.id!)])
  }

  if (loading) return (
    <div className="p-4 md:p-8 max-w-3xl md:max-w-none space-y-4">
      <div className="skeleton h-8 w-40" />
      <div className="card p-6 space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
      </div>
    </div>
  )

  return (
    <>
      <TopBar page="Settings" title="Settings" subtitle="Packages, AI training, and team management" />
      <div className="p-4 md:p-8 max-w-3xl md:max-w-none">
        <WelcomeCard
          storageKey="welcome-packages"
          icon="📦"
          title="Set up your packages & pricing"
          description="Define your service packages and prices here. Crafty AI uses these exact names and amounts when creating bookings or answering client inquiries."
          tips={[
            'Keep package names consistent — Crafty matches by name when creating bookings',
            'Add-ons appear as optional extras on top of your base packages',
            'Changes take effect immediately — no restart needed',
          ]}
          accentColor="#f59e0b"
        />

      <div className="mb-5">
        <h2 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Packages & Pricing</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Crafty AI uses these exact names and prices when creating bookings or answering inquiries.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl px-5 py-3 text-sm" style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid var(--danger-muted)' }}>
          {error}
        </div>
      )}

      <PackageSection
        title="Base Packages"
        rows={bases}
        onAdd={() => setBases(prev => [...prev, emptyBase()])}
        onDelete={(i) => deleteRow(bases, setBases, i)}
        onChange={(i, f, v) => updateRow(bases, setBases, i, f, v)}
      />

      <PackageSection
        title="Add-ons"
        rows={addons}
        onAdd={() => setAddons(prev => [...prev, emptyAddon()])}
        onDelete={(i) => deleteRow(addons, setAddons, i)}
        onChange={(i, f, v) => updateRow(addons, setAddons, i, f, v)}
      />

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-[10px] text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
        <button
          onClick={resetToDefaults}
          className="px-4 py-2.5 rounded-[10px] text-sm font-medium"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}
        >
          Reset to defaults
        </button>
      </div>

      <div className="mt-8 rounded-xl p-4 text-sm" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--card-border)' }}>
        <p className="font-semibold mb-1" style={{ color: 'var(--accent-text)' }}>⚡ How Crafty uses these</p>
        <p style={{ color: 'var(--text-secondary)' }}>
          When you or a client mentions a package by name, Crafty matches it to your list and uses the exact price.
          Package names in bookings and invoices also come from here.
          Changes take effect immediately — no restart needed.
        </p>
      </div>

      <TeamSection />
    </div>
  </>
  )
}

const TONE_OPTIONS: { value: AiTone; label: string }[] = [
  { value: 'casual_taglish', label: 'Casual Taglish (warm, uses "po")' },
  { value: 'casual_english', label: 'Casual English (friendly, relaxed)' },
  { value: 'formal_english', label: 'Formal English (professional)' },
]

function CraftyAISection() {
  const [form, setForm] = useState<AiSettings>({
    business_name: '', business_description: '', pricing_model: '',
    ai_rules: '', ai_tone: 'casual_taglish', ai_context: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const user = auth.currentUser
      if (!user) { setLoading(false); return }
      const snap = await getDoc(doc(db, 'profiles', user.uid))
      if (snap.exists()) {
        const d = snap.data()
        setForm({
          business_name: d.business_name ?? '',
          business_description: d.business_description ?? '',
          pricing_model: d.pricing_model ?? '',
          ai_rules: d.ai_rules ?? '',
          ai_tone: d.ai_tone ?? 'casual_taglish',
          ai_context: d.ai_context ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const user = auth.currentUser
    if (!user) return
    setSaving(true)
    await setDoc(doc(db, 'profiles', user.uid), form, { merge: true })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  function field(label: string, key: keyof AiSettings, placeholder: string, rows?: number) {
    return (
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
        {rows ? (
          <textarea
            rows={rows}
            className="w-full rounded-lg px-3 py-2.5 text-sm resize-none"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}
            placeholder={placeholder}
            value={form[key] as string ?? ''}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          />
        ) : (
          <input
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}
            placeholder={placeholder}
            value={form[key] as string ?? ''}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          />
        )}
      </div>
    )
  }

  if (loading) return <div className="skeleton h-48 rounded-2xl mt-10" />

  return (
    <div className="mt-10 pt-8" style={{ borderTop: '1px solid var(--border-secondary)' }}>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>⚡ Crafty AI Training</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Tell Crafty about your business so it responds correctly for your industry — not just photobooth.
        </p>
      </div>
      <form onSubmit={save} className="card p-5 space-y-4">
        {field('Business Name', 'business_name', 'e.g. Laagan Adventure Tours')}
        {field('What you offer', 'business_description', 'e.g. Day tours, island hopping, group packages around Zamboanga peninsula', 3)}
        {field('How you price', 'pricing_model', 'e.g. ₱500/head, minimum 4 pax. Custom group quotes on request.', 2)}
        {field('Rules for Crafty', 'ai_rules', 'e.g. Always ask group size first. Never quote without asking the event date.', 3)}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Reply Tone</label>
          <select
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}
            value={form.ai_tone}
            onChange={e => setForm(f => ({ ...f, ai_tone: e.target.value as AiTone }))}
          >
            {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {field('Extra context (optional)', 'ai_context', 'Anything else Crafty should know — FAQs, policies, common objections…', 3)}
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-[10px] text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save AI Training'}
        </button>
      </form>
    </div>
  )
}

function TeamSection() {
  const [members, setMembers] = useState<{ id: string; member_email: string; status: string }[]>([])
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    getDocs(query(collection(db, 'team_invites'), where('owner_id', '==', uid))).then(snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as { id: string; owner_id: string; member_email: string; status: string; created_at: string })
      setMembers(all.sort((a, b) => a.created_at.localeCompare(b.created_at)))
    })
  }, [])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true); setError('')
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    const data = await res.json()
    if (data.token) {
      const link = `${window.location.origin}/team/join/${data.token}`
      setInviteLink(link)
      setMembers(prev => [...prev, { id: data.token, member_email: email.trim(), status: 'pending' }])
      setEmail('')
    } else {
      setError(data.error ?? 'Failed to create invite.')
    }
    setInviting(false)
  }

  async function remove(inviteId: string) {
    await fetch('/api/team/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId }),
    })
    setMembers(prev => prev.filter(m => m.id !== inviteId))
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--card-border)' }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Team</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Invite staff to help manage leads and bookings. Staff can't access Finances, Ads, or Settings.
        </p>
      </div>

      {/* Current members */}
      {members.length > 0 && (
        <div className="card overflow-hidden mb-5">
          {members.map((m, i) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{m.member_email}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: m.status === 'accepted' ? 'var(--success-muted)' : 'var(--warning-muted)',
                    color: m.status === 'accepted' ? 'var(--success)' : 'var(--warning)',
                  }}>
                  {m.status === 'accepted' ? '✓ Active' : 'Pending'}
                </span>
              </div>
              <button onClick={() => remove(m.id)}
                className="text-xs px-2 py-1.5 rounded-lg"
                style={{ color: 'var(--danger)', background: 'var(--danger-muted)' }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      <form onSubmit={invite} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Staff email address"
          className="flex-1 rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" disabled={inviting || !email.trim()}
          className="px-4 py-2 rounded-[10px] text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          {inviting ? 'Inviting…' : 'Invite'}
        </button>
      </form>
      {error && <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>{error}</p>}

      {/* Invite link to copy */}
      {inviteLink && (
        <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--success-muted)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--success)' }}>Invite created — copy this link and send it to your staff:</p>
          <div className="flex items-center gap-2">
            <p className="text-xs flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{inviteLink}</p>
            <button onClick={copyLink}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold shrink-0"
              style={{ background: linkCopied ? 'var(--success)' : 'var(--accent)', color: '#fff' }}>
              {linkCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PackageSection({ title, rows, onAdd, onDelete, onChange }: {
  title: string
  rows: Row[]
  onAdd: () => void
  onDelete: (i: number) => void
  onChange: (i: number, field: keyof Row, value: string | boolean) => void
}) {
  const [removingIdx, setRemovingIdx] = useState<number | null>(null)

  function handleDelete(i: number) {
    setRemovingIdx(i)
    setTimeout(() => {
      onDelete(i)
      setRemovingIdx(null)
    }, 260)
  }

  return (
    <div className="mb-6">
      <h2 className="section-label mb-3">{title}</h2>
      <div className="card overflow-hidden">
        {rows.length === 0 && (
          <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-faint)' }}>No {title.toLowerCase()} yet. Add one below.</p>
        )}
        {rows.map((row, i) => (
          <div key={i} className="px-4 py-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center"
            style={{
              borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
              opacity: removingIdx === i ? 0 : 1,
              transform: removingIdx === i ? 'translateX(10px)' : 'none',
              maxHeight: removingIdx === i ? 0 : '120px',
              overflow: 'hidden',
              transition: 'opacity 0.22s ease, transform 0.22s ease, max-height 0.28s ease',
            }}>
            {/* Active toggle */}
            <button
              onClick={() => onChange(i, 'is_active', !row.is_active)}
              className="shrink-0 w-4 h-4 rounded border mt-2.5 sm:mt-0"
              style={{
                background: row.is_active ? 'var(--accent)' : 'transparent',
                borderColor: row.is_active ? 'var(--accent)' : 'var(--card-border)',
              }}
              title={row.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
            />
            {/* Name */}
            <input
              value={row.name}
              onChange={e => onChange(i, 'name', e.target.value)}
              placeholder="Package name"
              className="flex-1 min-w-0 rounded-lg px-3 py-1.5 text-sm"
              style={{ opacity: row.is_active ? 1 : 0.45 }}
            />
            {/* Description */}
            <input
              value={row.description}
              onChange={e => onChange(i, 'description', e.target.value)}
              placeholder="Description (optional)"
              className="flex-1 min-w-0 rounded-lg px-3 py-1.5 text-sm hidden sm:block"
              style={{ opacity: row.is_active ? 1 : 0.45 }}
            />
            {/* Price */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-sm" style={{ color: 'var(--text-faint)' }}>₱</span>
              <input
                type="number"
                value={row.price}
                onChange={e => onChange(i, 'price', e.target.value)}
                placeholder="0"
                className="w-24 rounded-lg px-3 py-1.5 text-sm tabular"
                style={{ opacity: row.is_active ? 1 : 0.45 }}
              />
            </div>
            {/* Delete */}
            <button
              onClick={() => handleDelete(i)}
              className="shrink-0 text-xs px-2 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--danger)', background: 'var(--danger-muted)' }}
            >
              Remove
            </button>
          </div>
        ))}
        <div style={{ borderTop: rows.length > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
          <button
            onClick={onAdd}
            className="w-full px-5 py-3 text-sm text-left transition-colors"
            style={{ color: 'var(--accent-text)' }}
          >
            + Add {title === 'Add-ons' ? 'add-on' : 'package'}
          </button>
        </div>
      </div>
    </div>
  )
}
