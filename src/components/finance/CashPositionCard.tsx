'use client'

import { useEffect, useState } from 'react'
import { auth, getDocsByUser, addDocument, updateDocument, deleteDocument } from '@/lib/firebase'
import type { PersonalCashPosition } from '@/types'

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

const EMPTY_FORM = { source_name: '', amount: '' }

export default function CashPositionCard({ onRefresh, refreshKey }: { onRefresh?: () => void; refreshKey?: number }) {
  const [positions, setPositions] = useState<PersonalCashPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function load() {
    const user = auth.currentUser
    if (!user) return
    const data = await getDocsByUser<PersonalCashPosition>('personal_cash_positions', user.uid)
    setPositions(data.sort((a, b) => a.source_name.localeCompare(b.source_name)))
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey])

  const total = positions.reduce((s, p) => s + p.amount, 0)

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function startEdit(p: PersonalCashPosition) {
    setEditingId(p.id)
    setForm({ source_name: p.source_name, amount: String(p.amount) })
    setShowForm(true)
  }

  async function save() {
    if (!form.source_name.trim() || !form.amount) return
    setSaving(true)
    const user = auth.currentUser
    if (!user) return
    const payload = {
      source_name: form.source_name.trim(),
      amount: parseFloat(form.amount),
      user_id: user.uid,
      updated_at: new Date().toISOString(),
    }
    if (editingId) {
      await updateDocument('personal_cash_positions', editingId, payload)
    } else {
      await addDocument('personal_cash_positions', payload)
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
    setEditingId(null)
    setSaving(false)
    await load()
    onRefresh?.()
  }

  async function remove(id: string) {
    if (!confirm('Remove this cash source?')) return
    await deleteDocument('personal_cash_positions', id)
    await load()
    onRefresh?.()
  }

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>Cash Position</h2>
        <button
          onClick={() => showForm ? setShowForm(false) : openAdd()}
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
            placeholder="Source name (e.g. Maribank savings)"
            value={form.source_name}
            onChange={e => setForm(f => ({ ...f, source_name: e.target.value }))}
          />
          <input
            type="number"
            inputMode="numeric"
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            placeholder="Amount (₱)"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-[10px] text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? 'Saving…' : editingId ? 'Update' : 'Add Source'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-9 rounded-lg" />)}
        </div>
      ) : positions.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>
          No cash sources yet — add Maribank, cash on hand, etc.
        </p>
      ) : (
        <div>
          {positions.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2.5"
              style={{ borderBottom: i < positions.length - 1 ? '1px solid var(--border-secondary)' : 'none' }}
            >
              <button
                onClick={() => startEdit(p)}
                className="text-sm text-left truncate mr-2"
                style={{ color: 'var(--text-body)' }}
              >
                {p.source_name}
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-semibold tabular text-sm" style={{ color: 'var(--accent-text)' }}>
                  {peso(p.amount)}
                </span>
                <button onClick={() => remove(p.id)} className="text-xs leading-none" style={{ color: 'var(--danger)' }}>✕</button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 mt-1" style={{ borderTop: '1px solid var(--card-border)' }}>
            <span className="section-label">Total Cash</span>
            <span className="text-lg font-bold tabular" style={{ color: 'var(--accent-text)' }}>{peso(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
