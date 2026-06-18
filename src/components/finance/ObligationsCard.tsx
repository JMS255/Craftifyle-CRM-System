'use client'

import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { auth, db, collection, query, where, addDocument, updateDocument, deleteDocument } from '@/lib/firebase'
import type { PersonalObligation, ObligationCategory } from '@/types'

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

const CATEGORIES: { value: ObligationCategory; label: string }[] = [
  { value: 'bills', label: 'Bills' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'rent', label: 'Rent' },
  { value: 'other', label: 'Other' },
]

const EMPTY_FORM = { name: '', amount: '', due_day: '1', category: 'bills' as ObligationCategory }

export default function ObligationsCard({ onRefresh, refreshKey }: { onRefresh?: () => void; refreshKey?: number }) {
  const [obligations, setObligations] = useState<PersonalObligation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const user = auth.currentUser
    if (!user) { setLoading(false); return }
    const q = query(
      collection(db, 'personal_obligations'),
      where('user_id', '==', user.uid),
      where('is_active', '==', true),
    )
    const unsub = onSnapshot(q, snap => {
      setObligations(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }) as PersonalObligation)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [refreshKey])

  const total = obligations.reduce((s, o) => s + o.amount, 0)

  function startEdit(o: PersonalObligation) {
    setEditingId(o.id)
    setForm({ name: o.name, amount: String(o.amount), due_day: String(o.due_day), category: o.category })
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim() || !form.amount) return
    setSaving(true)
    const user = auth.currentUser
    if (!user) { setSaving(false); return }
    const payload = {
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      due_day: parseInt(form.due_day) || 1,
      category: form.category,
      is_active: true,
      user_id: user.uid,
      updated_at: new Date().toISOString(),
    }
    if (editingId) {
      await updateDocument('personal_obligations', editingId, payload)
    } else {
      await addDocument('personal_obligations', { ...payload, created_at: new Date().toISOString() })
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
    setEditingId(null)
    setSaving(false)
    onRefresh?.()
  }

  async function remove(id: string) {
    if (!confirm('Remove this obligation?')) return
    await deleteDocument('personal_obligations', id)
    onRefresh?.()
  }

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>Monthly Obligations</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Recurring bills included in projection</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(v => !v) }}
          className="text-xs px-3 py-1.5 rounded-[10px] font-medium"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <div className="mb-3 p-3 rounded-xl space-y-2" style={{ background: 'var(--accent-subtle)' }}>
          <input
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            placeholder="Name (e.g. Globe Internet, Netflix)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <input
            type="number"
            inputMode="numeric"
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            placeholder="Monthly amount (₱)"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
          <div className="flex gap-2">
            <div className="flex-none">
              <label className="text-xs block mb-1" style={{ color: 'var(--text-faint)' }}>Due day</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-16 rounded-lg px-3 py-2.5 text-sm"
                placeholder="1"
                min={1}
                max={31}
                value={form.due_day}
                onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs block mb-1" style={{ color: 'var(--text-faint)' }}>Category</label>
              <select
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as ObligationCategory }))}
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-[10px] text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? 'Saving…' : editingId ? 'Update' : 'Add Obligation'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="skeleton h-9 rounded-lg" />)}
        </div>
      ) : obligations.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>
          No recurring obligations — add internet, rent, subscriptions, etc.
        </p>
      ) : (
        <div>
          {obligations.map((o, i) => (
            <div
              key={o.id}
              className="flex items-center justify-between py-2.5"
              style={{ borderBottom: i < obligations.length - 1 ? '1px solid var(--border-secondary)' : 'none' }}
            >
              <button
                onClick={() => startEdit(o)}
                className="text-sm text-left truncate mr-2"
                style={{ color: 'var(--text-body)' }}
              >
                {o.name}
                <span className="ml-1.5 text-xs" style={{ color: 'var(--text-faint)' }}>due {o.due_day}</span>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-semibold tabular text-sm" style={{ color: 'var(--danger)' }}>
                  {peso(o.amount)}
                </span>
                <button onClick={() => remove(o.id)} className="text-xs leading-none" style={{ color: 'var(--danger)' }}>✕</button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 mt-1" style={{ borderTop: '1px solid var(--card-border)' }}>
            <span className="section-label">Monthly total</span>
            <span className="text-lg font-bold tabular" style={{ color: 'var(--danger)' }}>{peso(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
