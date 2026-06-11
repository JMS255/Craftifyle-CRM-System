'use client'

import { useEffect, useState } from 'react'
import { auth, getDocsByUser, addDocument, updateDocument } from '@/lib/firebase'
import type { PersonalIncoming } from '@/types'

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

const EMPTY_FORM = { source: '', amount: '', expected_date: '', notes: '' }

export default function ConfirmedIncomingCard({ onRefresh, refreshKey }: { onRefresh?: () => void; refreshKey?: number }) {
  const [items, setItems] = useState<PersonalIncoming[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const user = auth.currentUser
    if (!user) return
    const data = await getDocsByUser<PersonalIncoming>('personal_incoming', user.uid)
    setItems(
      data
        .filter(i => i.status === 'pending')
        .sort((a, b) => a.expected_date.localeCompare(b.expected_date))
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey])

  const total = items.reduce((s, i) => s + i.amount, 0)

  async function add() {
    if (!form.source.trim() || !form.amount || !form.expected_date) return
    setError(null)
    setSaving(true)
    const user = auth.currentUser
    if (!user) { setError('Not signed in — please refresh.'); setSaving(false); return }
    try { await addDocument('personal_incoming', {
      user_id: user.uid,
      source: form.source.trim(),
      amount: parseFloat(form.amount),
      expected_date: form.expected_date,
      status: 'pending',
      notes: form.notes || null,
      created_at: new Date().toISOString(),
    })
    setForm(EMPTY_FORM)
    setShowForm(false)
    await load()
    onRefresh?.()
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed.') }
    setSaving(false)
  }

  async function markReceived(item: PersonalIncoming) {
    setMarkingId(item.id)
    const user = auth.currentUser
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    await updateDocument('personal_incoming', item.id, {
      status: 'received',
      updated_at: new Date().toISOString(),
    })
    await addDocument('personal_income', {
      user_id: user.uid,
      description: item.source,
      amount: item.amount,
      income_date: today,
      category: 'other',
      notes: 'Converted from confirmed incoming',
      created_at: new Date().toISOString(),
    })
    setMarkingId(null)
    await load()
    onRefresh?.()
  }

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>Confirmed Incoming</h2>
            {error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
          {items.length > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
              Not yet received · {peso(total)} total
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="text-xs px-3 py-1.5 rounded-[10px] font-medium"
          style={{ background: 'var(--success-muted)', color: 'var(--success)' }}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <div className="mb-3 p-3 rounded-xl space-y-2" style={{ background: 'var(--success-muted)' }}>
          <input
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            placeholder="Source (e.g. CHED Scholarship)"
            value={form.source}
            onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
          />
          <input
            type="number"
            inputMode="numeric"
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            placeholder="Amount (₱)"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Expected date</label>
            <input
              type="date"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              value={form.expected_date}
              onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))}
            />
          </div>
          <input
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          <button
            onClick={add}
            disabled={saving}
            className="w-full py-2.5 rounded-[10px] text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--success)' }}
          >
            {saving ? 'Saving…' : 'Add Incoming'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>
          No confirmed incoming — add scholarships, collections, family support.
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 py-2.5"
              style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border-secondary)' : 'none' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>
                  {item.source}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  Expected {fmtDate(item.expected_date)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold tabular text-sm" style={{ color: 'var(--success)' }}>
                  {peso(item.amount)}
                </span>
                <button
                  onClick={() => markReceived(item)}
                  disabled={markingId === item.id}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-50"
                  style={{ background: 'var(--success-muted)', color: 'var(--success)' }}
                >
                  {markingId === item.id ? '…' : 'Received'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
