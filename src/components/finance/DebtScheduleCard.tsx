'use client'

import { useEffect, useState } from 'react'
import { auth, getDocsByUser, addDocument, updateDocument, deleteDocument } from '@/lib/firebase'
import type { PersonalDebt, PersonalDebtPayment, DebtPaymentStatus } from '@/types'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

function monthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1]} '${y.slice(2)}`
}

function getDebtMonths(debt: PersonalDebt): string[] {
  const [sy, sm] = debt.start_month.split('-').map(Number)
  return Array.from({ length: debt.total_months }, (_, i) => {
    const d = new Date(sy, sm - 1 + i, 1)
    return d.toISOString().slice(0, 7)
  })
}

function nextStatus(s: DebtPaymentStatus): DebtPaymentStatus {
  if (s === 'unpaid') return 'planning'
  if (s === 'planning') return 'paid'
  return 'unpaid'
}

const STATUS: Record<DebtPaymentStatus, { bg: string; color: string; icon: string }> = {
  paid:     { bg: 'var(--success-muted)',        color: 'var(--success)',   icon: '✅' },
  planning: { bg: 'rgba(245,158,11,0.15)',        color: '#f59e0b',          icon: '🔄' },
  unpaid:   { bg: 'var(--card-elevated)',         color: 'var(--text-muted)',icon: '⏳' },
}

const EMPTY_FORM = {
  name: '',
  monthly_amount: '',
  start_month: new Date().toISOString().slice(0, 7),
  total_months: '6',
  interest_type: 'none' as 'none' | 'monthly_addon',
  type: 'formal' as 'formal' | 'pautang',
  person: '',
}

export default function DebtScheduleCard({ onRefresh, refreshKey }: { onRefresh?: () => void; refreshKey?: number }) {
  const [debts, setDebts] = useState<PersonalDebt[]>([])
  const [payments, setPayments] = useState<PersonalDebtPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const user = auth.currentUser
    if (!user) return
    const [d, p] = await Promise.all([
      getDocsByUser<PersonalDebt>('personal_debts', user.uid),
      getDocsByUser<PersonalDebtPayment>('personal_debt_payments', user.uid),
    ])
    setDebts(d.sort((a, b) => a.start_month.localeCompare(b.start_month)))
    setPayments(p)
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey])

  function getStatus(debtId: string, month: string): DebtPaymentStatus {
    return payments.find(p => p.debt_id === debtId && p.month === month)?.status ?? 'unpaid'
  }

  function getPayment(debtId: string, month: string): PersonalDebtPayment | undefined {
    return payments.find(p => p.debt_id === debtId && p.month === month)
  }

  async function cycleStatus(debt: PersonalDebt, month: string) {
    const key = `${debt.id}-${month}`
    setUpdatingKey(key)
    const user = auth.currentUser
    if (!user) return
    const current = getStatus(debt.id, month)
    const next = nextStatus(current)
    const existing = getPayment(debt.id, month)
    if (existing) {
      await updateDocument('personal_debt_payments', existing.id, { status: next, updated_at: new Date().toISOString() })
    } else {
      await addDocument('personal_debt_payments', {
        user_id: user.uid, debt_id: debt.id, month, status: next, updated_at: new Date().toISOString(),
      })
    }
    setUpdatingKey(null)
    await load()
    onRefresh?.()
  }

  async function addDebt() {
    if (!form.name.trim() || !form.monthly_amount || !form.start_month) return
    setError(null)
    setSaving(true)
    const user = auth.currentUser
    if (!user) { setError('Not signed in — please refresh.'); setSaving(false); return }
    try { await addDocument('personal_debts', {
      user_id: user.uid,
      name: form.name.trim(),
      monthly_amount: parseFloat(form.monthly_amount),
      start_month: form.start_month,
      total_months: parseInt(form.total_months),
      interest_type: form.interest_type,
      type: form.type,
      person: form.type === 'pautang' ? (form.person.trim() || null) : null,
      created_at: new Date().toISOString(),
    })
    setForm(EMPTY_FORM)
    setShowForm(false)
    await load()
    onRefresh?.()
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed.') }
    setSaving(false)
  }

  async function removeDebt(id: string) {
    if (!confirm('Delete this debt?')) return
    await deleteDocument('personal_debts', id)
    await load()
    onRefresh?.()
  }

  function nextPaymentInfo(debt: PersonalDebt) {
    const today = new Date().toISOString().slice(0, 7)
    const upcoming = getDebtMonths(debt).find(m => m >= today && getStatus(debt.id, m) !== 'paid')
    if (!upcoming) return null
    return { month: upcoming, status: getStatus(debt.id, upcoming) }
  }

  const totalRemaining = debts.reduce((sum, debt) => {
    const today = new Date().toISOString().slice(0, 7)
    const unpaid = getDebtMonths(debt).filter(m => m >= today && getStatus(debt.id, m) !== 'paid')
    return sum + unpaid.length * debt.monthly_amount
  }, 0)

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>Debt Schedule</h2>
            {error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
          {totalRemaining > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--danger)' }}>{peso(totalRemaining)} remaining</p>
          )}
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="text-xs px-3 py-1.5 rounded-[10px] font-medium"
          style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}
        >
          {showForm ? 'Cancel' : '+ Add Debt'}
        </button>
      </div>

      {showForm && (
        <div className="mb-3 p-3 rounded-xl space-y-2" style={{ background: 'var(--danger-muted)' }}>
          {/* Debt type toggle */}
          <div className="flex gap-2">
            {(['formal', 'pautang'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className="flex-1 py-2 rounded-lg text-xs font-semibold"
                style={form.type === t
                  ? { background: 'var(--danger)', color: '#fff' }
                  : { background: 'var(--card-elevated)', color: 'var(--text-muted)' }}
              >
                {t === 'formal' ? '🏦 Formal Loan' : '🤝 Pautang'}
              </button>
            ))}
          </div>
          {form.type === 'pautang' && (
            <input
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              placeholder="Person (e.g. Kuya Renz, Aling Maria)"
              value={form.person}
              onChange={e => setForm(f => ({ ...f, person: e.target.value }))}
            />
          )}
          <input
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            placeholder={form.type === 'pautang' ? 'What for? (e.g. borrowed for equipment)' : 'Debt name (e.g. Camera EWB)'}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Monthly amount (₱)</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                placeholder="11665"
                value={form.monthly_amount}
                onChange={e => setForm(f => ({ ...f, monthly_amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>No. of months</label>
              <input
                type="number"
                inputMode="numeric"
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                placeholder="6"
                value={form.total_months}
                onChange={e => setForm(f => ({ ...f, total_months: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Start month</label>
            <input
              type="month"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              value={form.start_month}
              onChange={e => setForm(f => ({ ...f, start_month: e.target.value }))}
            />
          </div>
          <select
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            value={form.interest_type}
            onChange={e => setForm(f => ({ ...f, interest_type: e.target.value as 'none' | 'monthly_addon' }))}
          >
            <option value="none">0% interest</option>
            <option value="monthly_addon">Monthly add-on interest</option>
          </select>
          <button
            onClick={addDebt}
            disabled={saving}
            className="w-full py-2.5 rounded-[10px] text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--danger)' }}
          >
            {saving ? 'Saving…' : 'Add Debt'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : debts.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>
          No debts tracked — add your obligations here.
        </p>
      ) : (
        <div className="space-y-2">
          {debts.map(debt => {
            const isOpen = expanded === debt.id
            const months = getDebtMonths(debt)
            const paidCount = months.filter(m => getStatus(debt.id, m) === 'paid').length
            const next = nextPaymentInfo(debt)

            return (
              <div key={debt.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : debt.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  style={{ background: 'var(--card-elevated)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-heading)' }}>
                      {debt.type === 'pautang' ? '🤝 ' : '🏦 '}{debt.name}
                      {debt.person && <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>· {debt.person}</span>}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      {peso(debt.monthly_amount)}/mo · {paidCount}/{debt.total_months} paid
                      {next && (
                        <span style={{ color: next.status === 'planning' ? '#f59e0b' : 'var(--danger)' }}>
                          {' '}· Next: {monthLabel(next.month)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={e => { e.stopPropagation(); removeDebt(debt.id) }}
                      className="p-1 leading-none"
                      style={{ color: 'var(--text-faint)' }}
                    >✕</button>
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 py-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                    <div className="flex flex-wrap gap-2">
                      {months.map(month => {
                        const status = getStatus(debt.id, month)
                        const style = STATUS[status]
                        const key = `${debt.id}-${month}`
                        return (
                          <button
                            key={month}
                            onClick={() => cycleStatus(debt, month)}
                            disabled={updatingKey === key}
                            className="flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-40 transition-all"
                            style={{ background: style.bg, color: style.color, minWidth: '52px' }}
                          >
                            <span>{style.icon}</span>
                            <span className="mt-0.5">{monthLabel(month)}</span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
                      Tap to cycle: ⏳ Unpaid → 🔄 Planning → ✅ Paid
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
