'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, getDocsByUser } from '@/lib/firebase'
import type { PersonalCashPosition, PersonalIncoming, PersonalDebt, PersonalDebtPayment, PersonalIncome, PersonalExpense, PersonalObligation } from '@/types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function peso(n: number) {
  return '₱' + Math.round(n).toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

export interface ProjectionMonth {
  yyyymm: string
  label: string
  openingCash: number
  revenue: number
  incoming: number
  debt: number
  expenses: number
  endCash: number
}

function computeProjection(
  cashPositions: PersonalCashPosition[],
  debts: PersonalDebt[],
  payments: PersonalDebtPayment[],
  pendingIncoming: PersonalIncoming[],
  recentIncome: PersonalIncome[],
  recentExpenses: PersonalExpense[],
  obligations: PersonalObligation[],
): ProjectionMonth[] {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10)

  const recentInc = recentIncome.filter(e => e.income_date >= threeMonthsAgo)
  const avgRevenue = recentInc.length ? Math.round(recentInc.reduce((s, e) => s + e.amount, 0) / 3) : 21000

  const recentExp = recentExpenses.filter(e => e.expense_date >= threeMonthsAgo)
  const avgExpenses = recentExp.length ? Math.round(recentExp.reduce((s, e) => s + e.amount, 0) / 3) : 5000

  const obligationsTotal = obligations.filter(o => o.is_active).reduce((s, o) => s + o.amount, 0)

  let runningCash = cashPositions.reduce((s, p) => s + p.amount, 0)

  return Array.from({ length: 6 }, (_, i) => {
    const totalM = now.getMonth() + i
    const ym = `${now.getFullYear() + Math.floor(totalM / 12)}-${String((totalM % 12) + 1).padStart(2, '0')}`

    const monthDebt = debts.reduce((sum, debt) => {
      const [sy, sm] = debt.start_month.split('-').map(Number)
      const [dy, dm] = ym.split('-').map(Number)
      const idx = (dy - sy) * 12 + (dm - sm)
      if (idx < 0 || idx >= debt.total_months) return sum
      const payment = payments.find(p => p.debt_id === debt.id && p.month === ym)
      if (payment?.status === 'paid') return sum
      const amt = debt.monthly_amounts?.[idx] ?? debt.monthly_amount
      return sum + amt
    }, 0)

    const monthIncoming = pendingIncoming
      .filter(p => p.status === 'pending' && p.expected_date.slice(0, 7) === ym)
      .reduce((s, p) => s + p.amount, 0)

    const openingCash = runningCash
    const totalExpenses = avgExpenses + obligationsTotal
    const endCash = openingCash + avgRevenue + monthIncoming - monthDebt - totalExpenses
    runningCash = endCash

    return {
      yyyymm: ym,
      label: `${MONTH_NAMES[parseInt(ym.split('-')[1]) - 1]} ${ym.split('-')[0]}`,
      openingCash,
      revenue: avgRevenue,
      incoming: monthIncoming,
      debt: monthDebt,
      expenses: totalExpenses,
      endCash,
    }
  })
}

function statusStyle(endCash: number) {
  if (endCash < 0)     return { bg: 'rgba(239,68,68,0.1)',  text: '#ef4444', label: '🔴 Danger' }
  if (endCash < 10000) return { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', label: '🟡 Tight' }
  return               { bg: 'rgba(16,185,129,0.1)',        text: '#10b981', label: '🟢 On Track' }
}

export default function SurvivalProjectionCard({
  refreshKey,
  onProjectionReady,
}: {
  refreshKey?: number
  onProjectionReady?: (months: ProjectionMonth[]) => void
}) {
  const [projection, setProjection] = useState<ProjectionMonth[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)

  async function load(uid: string) {
    const [cashPositions, debts, payments, allIncoming, incomeHistory, expenseHistory, obligations] = await Promise.all([
      getDocsByUser<PersonalCashPosition>('personal_cash_positions', uid),
      getDocsByUser<PersonalDebt>('personal_debts', uid),
      getDocsByUser<PersonalDebtPayment>('personal_debt_payments', uid),
      getDocsByUser<PersonalIncoming>('personal_incoming', uid),
      getDocsByUser<PersonalIncome>('personal_income', uid),
      getDocsByUser<PersonalExpense>('personal_expenses', uid),
      getDocsByUser<PersonalObligation>('personal_obligations', uid),
    ])
    const pending = allIncoming.filter(i => i.status === 'pending')
    const months = computeProjection(cashPositions, debts, payments, pending, incomeHistory, expenseHistory, obligations)
    setProjection(months)
    setLoading(false)
    onProjectionReady?.(months)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { setLoading(false); return }
      load(user.uid)
    })
    return () => unsub()
  }, [refreshKey])

  if (loading) return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-4 w-36 rounded" />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-8 w-8 rounded-full" />
        <div className="skeleton h-4 w-28 rounded" />
        <div className="skeleton h-8 w-8 rounded-full" />
      </div>
      <div className="space-y-1.5">
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-9 rounded-lg" />)}
      </div>
    </div>
  )

  if (!projection.length) return null

  const month = projection[idx]
  const { bg, text, label } = statusStyle(month.endCash)

  const rows = [
    { label: 'Opening cash',    value: month.openingCash, color: 'var(--text-heading)', sign: '' },
    { label: '+ Revenue (avg)', value: month.revenue,     color: 'var(--accent-text)',  sign: '+' },
    { label: '+ Incoming',      value: month.incoming,    color: 'var(--success)',      sign: '+' },
    { label: '− Debt due',      value: month.debt,        color: 'var(--danger)',       sign: '−' },
    { label: '− Est. expenses', value: month.expenses,    color: 'var(--danger)',       sign: '−' },
  ]

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>Survival Projection</h2>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: bg, color: text }}>
          {label}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="w-9 h-9 flex items-center justify-center rounded-full text-sm disabled:opacity-30 transition-opacity"
          style={{ background: 'var(--card-elevated)', color: 'var(--text-heading)' }}
        >◀</button>
        <span className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>{month.label}</span>
        <button
          onClick={() => setIdx(i => Math.min(projection.length - 1, i + 1))}
          disabled={idx === projection.length - 1}
          className="w-9 h-9 flex items-center justify-center rounded-full text-sm disabled:opacity-30 transition-opacity"
          style={{ background: 'var(--card-elevated)', color: 'var(--text-heading)' }}
        >▶</button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--border-secondary)' }}
          >
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            <span className="font-semibold tabular text-sm" style={{ color: row.color }}>
              {row.sign}{peso(row.value)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: bg }}>
          <span className="font-semibold text-sm" style={{ color: text }}>Projected end cash</span>
          <span className="font-bold tabular text-base" style={{ color: text }}>{peso(month.endCash)}</span>
        </div>
      </div>

      <div className="flex justify-center gap-1.5 mt-3">
        {projection.map((m, i) => {
          const { text: dotColor } = statusStyle(m.endCash)
          return (
            <button
              key={m.yyyymm}
              onClick={() => setIdx(i)}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? '20px' : '8px',
                height: '8px',
                background: i === idx ? dotColor : 'var(--border-secondary)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
