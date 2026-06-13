'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import WelcomeCard from '@/components/WelcomeCard'
import { auth, getAllDocs, deleteDocument } from '@/lib/firebase'
import type { PersonalIncome, PersonalExpense, IncomeCategory, ExpenseCategory } from '@/types'
import CashPositionCard from '@/components/finance/CashPositionCard'
import ConfirmedIncomingCard from '@/components/finance/ConfirmedIncomingCard'
import DebtScheduleCard from '@/components/finance/DebtScheduleCard'
import SurvivalProjectionCard, { type ProjectionMonth } from '@/components/finance/SurvivalProjectionCard'
import FinanceStatusBanner from '@/components/finance/FinanceStatusBanner'
import FinanceAIInput from '@/components/finance/FinanceAIInput'
import TopBar from '@/components/TopBar'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const INCOME_CATEGORIES: IncomeCategory[] = ['tips', 'personal_gig', 'salary', 'freelance', 'other']
const EXPENSE_CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'equipment', 'bills', 'personal', 'other']

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

interface MonthData {
  yearMonth: string
  monthLabel: string
  income: PersonalIncome[]
  expenses: PersonalExpense[]
  totalIncome: number
  totalExpenses: number
  net: number
}

function buildMonths(income: PersonalIncome[], expenses: PersonalExpense[], year: string): MonthData[] {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const yearMonth = `${year}-${String(m).padStart(2, '0')}`
    const monthIncome = income.filter(e => e.income_date.startsWith(yearMonth))
    const monthExpenses = expenses.filter(e => e.expense_date.startsWith(yearMonth))
    const totalIncome = monthIncome.reduce((s, e) => s + e.amount, 0)
    const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0)
    return {
      yearMonth,
      monthLabel: MONTH_NAMES[i],
      income: monthIncome.sort((a, b) => b.income_date.localeCompare(a.income_date)),
      expenses: monthExpenses.sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
    }
  })
    .reverse()
}

export default function PersonalPage() {
  const [income, setIncome] = useState<PersonalIncome[]>([])
  const [expenses, setExpenses] = useState<PersonalExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [openMonth, setOpenMonth] = useState<string | null>(new Date().toISOString().slice(0, 7))
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [projectionMonths, setProjectionMonths] = useState<ProjectionMonth[]>([])
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) setAuthReady(true)
    })
    return () => unsub()
  }, [])

  // Manual entry form state (fallback for when AI isn't preferred)
  const [showManual, setShowManual] = useState(false)
  const [manualMode, setManualMode] = useState<'income' | 'expense'>('income')
  const [manualForm, setManualForm] = useState({
    description: '', amount: '', date: new Date().toISOString().slice(0, 10),
    category_income: 'other' as IncomeCategory,
    category_expense: 'other' as ExpenseCategory,
  })
  const [saving, setSaving] = useState(false)

  function handleRefresh() {
    setRefreshKey(k => k + 1)
  }

  async function load() {
    const [inc, exp] = await Promise.all([
      getAllDocs<PersonalIncome>('personal_income'),
      getAllDocs<PersonalExpense>('personal_expenses'),
    ])
    setIncome(inc.sort((a, b) => b.income_date.localeCompare(a.income_date)))
    setExpenses(exp.sort((a, b) => b.expense_date.localeCompare(a.expense_date)))
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey])

  const allDates = [
    ...income.map(e => e.income_date.slice(0, 4)),
    ...expenses.map(e => e.expense_date.slice(0, 4)),
  ]
  const currentYear = String(new Date().getFullYear())
  const years = Array.from(new Set(allDates)).sort((a, b) => b.localeCompare(a))
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const months = buildMonths(income, expenses, selectedYear)

  const yearIncome = income.filter(e => e.income_date.startsWith(selectedYear))
  const yearExpenses = expenses.filter(e => e.expense_date.startsWith(selectedYear))
  const yearTotalIncome = yearIncome.reduce((s, e) => s + e.amount, 0)
  const yearTotalExpenses = yearExpenses.reduce((s, e) => s + e.amount, 0)
  const yearNet = yearTotalIncome - yearTotalExpenses
  const bestMonth = [...months].sort((a, b) => b.net - a.net)[0]

  async function saveManual(ev: React.FormEvent) {
    ev.preventDefault()
    if (!manualForm.description.trim() || !manualForm.amount) return
    setSaving(true)
    const user = auth.currentUser
    const now = new Date().toISOString()
    if (manualMode === 'income') {
      const { addDocument } = await import('@/lib/firebase')
      await addDocument('personal_income', {
        description: manualForm.description.trim(),
        amount: parseFloat(manualForm.amount),
        income_date: manualForm.date,
        category: manualForm.category_income,
        notes: null,
        user_id: user?.uid ?? '',
        created_at: now,
      })
    } else {
      const { addDocument } = await import('@/lib/firebase')
      await addDocument('personal_expenses', {
        description: manualForm.description.trim(),
        amount: parseFloat(manualForm.amount),
        expense_date: manualForm.date,
        category: manualForm.category_expense,
        notes: null,
        user_id: user?.uid ?? '',
        created_at: now,
      })
    }
    setManualForm(f => ({ ...f, description: '', amount: '' }))
    setShowManual(false)
    setSaving(false)
    handleRefresh()
  }

  async function deleteIncome(id: string) {
    if (!confirm('Delete this income entry?')) return
    setDeletingId(id)
    await deleteDocument('personal_income', id)
    setDeletingId(null)
    handleRefresh()
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    setDeletingId(id)
    await deleteDocument('personal_expenses', id)
    setDeletingId(null)
    handleRefresh()
  }

  return (
    <>
      <TopBar
        page="Finances"
        title="Personal Finance"
        subtitle="Your money, separate from Craftifyle"
        actions={
          <button
            onClick={() => setShowManual(s => !s)}
            className="text-xs px-3 py-1.5 rounded-[8px] font-medium"
            style={{ background: 'var(--card-elevated)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}
          >
            {showManual ? 'Cancel' : '+ Manual'}
          </button>
        }
      />
      <div className="p-4 md:p-8 pb-8">

      <WelcomeCard
        storageKey="welcome-finances"
        icon="💰"
        title="Track your personal money"
        description="Log your income, expenses, and debts separate from your business revenue. Know exactly where your money goes and what you owe every month."
        tips={[
          'Log daily expenses by category to see where your money goes each month',
          'Track debts with a payment schedule so you never miss a monthly payment',
          'Cash Position shows your total money across all wallets and sources right now',
        ]}
        accentColor="#10b981"
      />

      {/* Manual entry fallback */}
      {showManual && (
        <div className="card p-4 mb-4">
          <div className="flex gap-2 mb-3">
            {(['income', 'expense'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setManualMode(mode)}
                className="flex-1 py-2 rounded-[10px] text-sm font-medium capitalize"
                style={manualMode === mode
                  ? { background: mode === 'income' ? 'var(--accent)' : 'var(--danger)', color: '#fff' }
                  : { background: 'var(--card-elevated)', color: 'var(--text-muted)' }}
              >
                {mode}
              </button>
            ))}
          </div>
          <form onSubmit={saveManual} className="space-y-2">
            <input
              required
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              placeholder="Description"
              value={manualForm.description}
              onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                type="number"
                inputMode="numeric"
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                placeholder="Amount (₱)"
                value={manualForm.amount}
                onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))}
              />
              <input
                type="date"
                className="w-full rounded-lg px-3 py-2.5 text-sm"
                value={manualForm.date}
                onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <select
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              value={manualMode === 'income' ? manualForm.category_income : manualForm.category_expense}
              onChange={e => manualMode === 'income'
                ? setManualForm(f => ({ ...f, category_income: e.target.value as IncomeCategory }))
                : setManualForm(f => ({ ...f, category_expense: e.target.value as ExpenseCategory }))
              }
            >
              {(manualMode === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                <option key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-[10px] text-sm font-medium text-white disabled:opacity-50"
              style={{ background: manualMode === 'income' ? 'var(--accent)' : 'var(--danger)' }}
            >
              {saving ? 'Saving…' : `Save ${manualMode}`}
            </button>
          </form>
        </div>
      )}

      {/* AI bar — mobile only, top of page */}
      {authReady && (
        <div className="md:hidden">
          <FinanceAIInput onRefresh={handleRefresh} />
        </div>
      )}

      {/* Responsive two-column layout */}
      <div className="md:grid md:grid-cols-5 md:gap-6 md:items-start">

        {/* LEFT / main column — all content on mobile, left 3/5 on desktop */}
        <div className="md:col-span-3">
          {!authReady ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
            </div>
          ) : (
            <>
              <FinanceStatusBanner months={projectionMonths} />
              <SurvivalProjectionCard
                refreshKey={refreshKey}
                onProjectionReady={setProjectionMonths}
              />
              <CashPositionCard refreshKey={refreshKey} onRefresh={handleRefresh} />
              <ConfirmedIncomingCard refreshKey={refreshKey} onRefresh={handleRefresh} />
              <DebtScheduleCard refreshKey={refreshKey} onRefresh={handleRefresh} />
            </>
          )}

          {/* History */}
          <div className="mt-5 mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>
              Income &amp; Expenses History
            </h2>
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Year:</span>
            {years.map(y => (
              <button
                key={y}
                onClick={() => {
                  setSelectedYear(y)
                  setOpenMonth(y === currentYear ? new Date().toISOString().slice(0, 7) : null)
                }}
                className="text-sm px-4 py-1.5 rounded-full font-semibold"
                style={selectedYear === y
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Year summary KPIs */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <SummaryCard label="Total Income"   value={peso(yearTotalIncome)}   color="purple" />
            <SummaryCard label="Total Expenses" value={peso(yearTotalExpenses)} color="red" />
            <SummaryCard label="Net Income"     value={peso(yearNet)}            color={yearNet >= 0 ? 'green' : 'red'} />
            <SummaryCard
              label="Best Month"
              value={bestMonth?.net > 0 ? bestMonth.monthLabel : '—'}
              color="indigo"
              sub={bestMonth?.net > 0 ? peso(bestMonth.net) : ''}
            />
          </div>

          {/* Monthly accordion */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card px-5 py-3.5 flex items-center justify-between">
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton h-4 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {months.map(month => {
                const isOpen = openMonth === month.yearMonth
                const hasData = month.income.length > 0 || month.expenses.length > 0
                return (
                  <div key={month.yearMonth} className="card overflow-hidden">
                    <button
                      onClick={() => hasData && setOpenMonth(isOpen ? null : month.yearMonth)}
                      disabled={!hasData}
                      className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${hasData ? 'cursor-pointer' : 'cursor-default opacity-40'}`}
                      onMouseEnter={e => hasData && ((e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '')}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-faint)' }}>
                          {hasData ? '▶' : '—'}
                        </span>
                        <span className="font-semibold w-24" style={{ color: 'var(--text-heading)' }}>{month.monthLabel}</span>
                        {hasData ? (
                          <div className="flex gap-3 text-xs">
                            <span className="font-medium" style={{ color: 'var(--accent-text)' }}>+{peso(month.totalIncome)}</span>
                            {month.totalExpenses > 0 && (
                              <span className="font-medium" style={{ color: 'var(--danger)' }}>−{peso(month.totalExpenses)}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>No entries</span>
                        )}
                      </div>
                      {hasData && (
                        <span className="text-sm font-bold tabular" style={{ color: month.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {month.net >= 0 ? '+' : ''}{peso(month.net)} net
                        </span>
                      )}
                    </button>

                    {hasData && (
                      <div style={{
                        overflow: 'hidden',
                        maxHeight: isOpen ? '1800px' : '0',
                        opacity: isOpen ? 1 : 0,
                        transition: isOpen
                          ? 'max-height 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease 0.05s'
                          : 'max-height 0.22s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.15s ease',
                      }}>
                      <div style={{ borderTop: '1px solid var(--card-border)' }}>
                        {month.income.length > 0 && (
                          <div>
                            <div className="px-5 py-2" style={{ background: 'var(--accent-subtle)', borderBottom: '1px solid var(--card-border)' }}>
                              <span className="section-label" style={{ color: 'var(--accent-text)' }}>
                                Income — {peso(month.totalIncome)}
                              </span>
                            </div>
                            <table className="w-full text-sm">
                              <tbody>
                                {month.income.map(e => (
                                  <tr key={e.id} style={{ borderTop: '1px solid var(--border-secondary)' }}>
                                    <td className="px-5 py-2.5 font-medium" style={{ color: 'var(--text-heading)' }}>{e.description}</td>
                                    <td className="px-3 py-2.5 text-xs hidden sm:table-cell" style={{ color: 'var(--text-faint)' }}>{fmtDate(e.income_date)}</td>
                                    <td className="px-3 py-2.5 hidden sm:table-cell">
                                      <span className="badge capitalize" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>
                                        {e.category.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 tabular text-right font-bold" style={{ color: 'var(--accent-text)' }}>{peso(e.amount)}</td>
                                    <td className="px-3 py-2.5">
                                      <button onClick={() => deleteIncome(e.id)} disabled={deletingId === e.id} className="text-xs disabled:opacity-50" style={{ color: 'var(--danger)' }}>
                                        {deletingId === e.id ? '…' : 'Del'}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {month.expenses.length > 0 && (
                          <div>
                            <div className="px-5 py-2" style={{ background: 'var(--danger-muted)', borderTop: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)' }}>
                              <span className="section-label" style={{ color: 'var(--danger)' }}>
                                Expenses — {peso(month.totalExpenses)}
                              </span>
                            </div>
                            <table className="w-full text-sm">
                              <tbody>
                                {month.expenses.map(e => (
                                  <tr key={e.id} style={{ borderTop: '1px solid var(--border-secondary)' }}>
                                    <td className="px-5 py-2.5 font-medium" style={{ color: 'var(--text-heading)' }}>{e.description}</td>
                                    <td className="px-3 py-2.5 text-xs hidden sm:table-cell" style={{ color: 'var(--text-faint)' }}>{fmtDate(e.expense_date)}</td>
                                    <td className="px-3 py-2.5 hidden sm:table-cell">
                                      <span className="badge capitalize" style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}>
                                        {e.category}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 tabular text-right font-bold" style={{ color: 'var(--danger)' }}>−{peso(e.amount)}</td>
                                    <td className="px-3 py-2.5">
                                      <button onClick={() => deleteExpense(e.id)} disabled={deletingId === e.id} className="text-xs disabled:opacity-50" style={{ color: 'var(--danger)' }}>
                                        {deletingId === e.id ? '…' : 'Del'}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="flex items-center justify-between px-5 py-3" style={{ background: 'var(--card-elevated)', borderTop: '1px solid var(--card-border)' }}>
                          <span className="section-label">{month.monthLabel} Net</span>
                          <span className="font-bold tabular" style={{ color: month.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {month.net >= 0 ? '+' : ''}{peso(month.net)}
                          </span>
                        </div>
                      </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT / AI sidebar — desktop only, stays visible while left scrolls */}
        <div className="hidden md:block md:col-span-2 md:sticky md:top-4 md:self-start">
          {authReady && (
            <>
              <FinanceAIInput onRefresh={handleRefresh} />
            </>
          )}

          {/* Quick Stats */}
          {authReady && <div className="card p-4 mt-1">
            <p className="section-label mb-3">
              {months[0]?.monthLabel ?? 'This Month'}
            </p>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="skeleton h-5 rounded" />)}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>Income</span>
                  <span className="font-semibold tabular" style={{ color: 'var(--success)' }}>
                    +{peso(months[0]?.totalIncome ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>Expenses</span>
                  <span className="font-semibold tabular" style={{ color: 'var(--danger)' }}>
                    −{peso(months[0]?.totalExpenses ?? 0)}
                  </span>
                </div>
                {projectionMonths[0]?.debt > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Debt due</span>
                    <span className="font-semibold tabular" style={{ color: 'var(--danger)' }}>
                      −{peso(projectionMonths[0].debt)}
                    </span>
                  </div>
                )}
                {projectionMonths[0]?.incoming > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Expected in</span>
                    <span className="font-semibold tabular" style={{ color: 'var(--accent-text)' }}>
                      +{peso(projectionMonths[0].incoming)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2" style={{ borderTop: '1px solid var(--card-border)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-heading)' }}>Net so far</span>
                  <span className="font-bold tabular" style={{ color: (months[0]?.net ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {(months[0]?.net ?? 0) >= 0 ? '+' : ''}{peso(months[0]?.net ?? 0)}
                  </span>
                </div>
              </div>
            )}
          </div>}

          {/* Projection runway pill */}
          {authReady && projectionMonths.length > 0 && (
            <div className="card p-4 mt-3">
              <p className="section-label mb-3">6-Month Outlook</p>
              <div className="flex gap-1.5 flex-wrap">
                {projectionMonths.map(m => {
                  const isGood = m.endCash >= 10000
                  const isTight = m.endCash >= 0 && m.endCash < 10000
                  const bg = isGood ? 'var(--success-muted)' : isTight ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.12)'
                  const color = isGood ? 'var(--success)' : isTight ? '#f59e0b' : '#ef4444'
                  return (
                    <div key={m.yyyymm} className="flex-1 min-w-[64px] rounded-xl px-2 py-2 text-center" style={{ background: bg }}>
                      <p className="text-xs font-medium truncate" style={{ color }}>{m.label.split(' ')[0]}</p>
                      <p className="text-xs font-bold tabular mt-0.5" style={{ color }}>
                        ₱{Math.round(m.endCash / 1000)}k
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  </>
  )
}

function SummaryCard({ label, value, color, sub }: {
  label: string; value: string; color: 'purple' | 'red' | 'green' | 'indigo'; sub?: string
}) {
  const vars = {
    purple: { bg: 'var(--accent-subtle)',  text: 'var(--accent-text)' },
    red:    { bg: 'var(--danger-muted)',   text: 'var(--danger)' },
    green:  { bg: 'var(--success-muted)',  text: 'var(--success)' },
    indigo: { bg: 'var(--accent-subtle2)', text: 'var(--accent-text)' },
  }
  const v = vars[color]
  return (
    <div className="rounded-xl p-4" style={{ background: v.bg, border: '1px solid var(--card-border)' }}>
      <p className="text-xl font-bold tabular" style={{ color: v.text }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: v.text, opacity: 0.7 }}>{sub}</p>}
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}
