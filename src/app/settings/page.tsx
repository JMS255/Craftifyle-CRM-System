'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

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

  const db = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await db.auth.getUser()
      if (!user) return
      const { data } = await db.from('packages').select('*').eq('user_id', user.id).order('sort_order')
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
      const { data: { user } } = await db.auth.getUser()
      if (!user) return

      const allRows = [
        ...bases.map((r, i) => ({ ...r, sort_order: i, is_addon: false })),
        ...addons.map((r, i) => ({ ...r, sort_order: i, is_addon: true })),
      ].filter(r => r.name.trim())

      // Replace all — delete existing then re-insert
      const { error: delErr } = await db.from('packages').delete().eq('user_id', user.id)
      if (delErr) throw new Error(delErr.message)

      if (allRows.length > 0) {
        const { error: insertErr } = await db.from('packages').insert(
          allRows.map((r, i) => ({
            user_id: user.id,
            name: r.name.trim(),
            price: parseFloat(r.price) || 0,
            description: r.description?.trim() || null,
            is_addon: r.is_addon,
            is_active: r.is_active,
            sort_order: i,
          }))
        )
        if (insertErr) throw new Error(insertErr.message)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      setDeletedIds([])

      const { data } = await db.from('packages').select('*').eq('user_id', user.id).order('sort_order')
      if (data) {
        setBases(data.filter(p => !p.is_addon).map(p => ({ ...p, price: String(p.price) })))
        setAddons(data.filter(p => p.is_addon).map(p => ({ ...p, price: String(p.price) })))
      }
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
    <div className="p-4 md:p-8 max-w-3xl md:max-w-none">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Packages & Pricing</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Crafty AI uses these exact names and prices when creating bookings or answering inquiries.
        </p>
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
  return (
    <div className="mb-6">
      <h2 className="section-label mb-3">{title}</h2>
      <div className="card overflow-hidden">
        {rows.length === 0 && (
          <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-faint)' }}>No {title.toLowerCase()} yet. Add one below.</p>
        )}
        {rows.map((row, i) => (
          <div key={i} className="px-4 py-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center"
            style={{ borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
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
              onClick={() => onDelete(i)}
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
