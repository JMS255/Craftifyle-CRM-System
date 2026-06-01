'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { PersonalIncome, PersonalExpense, IncomeCategory, ExpenseCategory } from '@/types'

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

function buildMonths(
  income: PersonalIncome[],
  expenses: PersonalExpense[],
  year: string
): MonthData[] {
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const yearMonth = `${year}-${String(m).padStart(2, '0')}`
    const monthIncome = income.filter((e) => e.income_date.startsWith(yearMonth))
    const monthExpenses = expenses.filter((e) => e.expense_date.startsWith(yearMonth))
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
    .filter(({ yearMonth }) => {
      const [y, mo] = yearMonth.split('-').map(Number)
      if (y < now.getFullYear()) return true
      return mo <= now.getMonth() + 1
    })
    .reverse()
}

const EMPTY_INCOME = {
  description: '', amount: '', income_date: new Date().toISOString().slice(0, 10),
  category: 'other' as IncomeCategory, notes: '',
}
const EMPTY_EXPENSE = {
  description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10),
  category: 'other' as ExpenseCategory, notes: '',
}

type FormMode = 'income' | 'expense' | null

export default function PersonalPage() {
  const [income, setIncome] = useState<PersonalIncome[]>([])
  const [expenses, setExpenses] = useState<PersonalExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [openMonth, setOpenMonth] = useState<string | null>(new Date().toISOString().slice(0, 7))
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [incomeForm, setIncomeForm] = useState(EMPTY_INCOME)
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const db = createClient()

  async function load() {
    const [{ data: inc, error: incErr }, { data: exp, error: expErr }] = await Promise.all([
      db.from('personal_income').select('*').order('income_date', { ascending: false }),
      db.from('personal_expenses').select('*').order('expense_date', { ascending: false }),
    ])
    if (expErr) setError(`Expenses table error: ${expErr.message}. Did you run the SQL migration?`)
    if (incErr) setError(`Income table error: ${incErr.message}`)
    setIncome(inc ?? [])
    setExpenses(exp ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const allDates = [
    ...income.map((e) => e.income_date.slice(0, 4)),
    ...expenses.map((e) => e.expense_date.slice(0, 4)),
  ]
  const years = Array.from(new Set(allDates)).sort((a, b) => b.localeCompare(a))
  const currentYear = String(new Date().getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const months = buildMonths(income, expenses, selectedYear)

  // Year totals
  const yearIncome = income.filter((e) => e.income_date.startsWith(selectedYear))
  const yearExpenses = expenses.filter((e) => e.expense_date.startsWith(selectedYear))
  const yearTotalIncome = yearIncome.reduce((s, e) => s + e.amount, 0)
  const yearTotalExpenses = yearExpenses.reduce((s, e) => s + e.amount, 0)
  const yearNet = yearTotalIncome - yearTotalExpenses

  // Best month
  const bestMonth = [...months].sort((a, b) => b.net - a.net)[0]

  async function saveIncome(ev: React.FormEvent) {
    ev.preventDefault()
    if (!incomeForm.description.trim() || !incomeForm.amount) return
    setSaving(true)
    setError('')
    const { data: { user } } = await db.auth.getUser()
    const { error: err } = await db.from('personal_income').insert({
      description: incomeForm.description.trim(),
      amount: parseFloat(incomeForm.amount),
      income_date: incomeForm.income_date,
      category: incomeForm.category,
      notes: incomeForm.notes || null,
      user_id: user?.id,
    })
    if (err) { setError(`Could not save income: ${err.message}`); setSaving(false); return }
    setIncomeForm(EMPTY_INCOME)
    setFormMode(null)
    setSaving(false)
    load()
  }

  async function saveExpense(ev: React.FormEvent) {
    ev.preventDefault()
    if (!expenseForm.description.trim() || !expenseForm.amount) return
    setSaving(true)
    setError('')
    const { data: { user } } = await db.auth.getUser()
    const { error: err } = await db.from('personal_expenses').insert({
      description: expenseForm.description.trim(),
      amount: parseFloat(expenseForm.amount),
      expense_date: expenseForm.expense_date,
      category: expenseForm.category,
      notes: expenseForm.notes || null,
      user_id: user?.id,
    })
    if (err) { setError(`Could not save expense: ${err.message}`); setSaving(false); return }
    setExpenseForm(EMPTY_EXPENSE)
    setFormMode(null)
    setSaving(false)
    load()
  }

  async function deleteIncome(id: string) {
    if (!confirm('Delete this income entry?')) return
    setDeletingId(id)
    await db.from('personal_income').delete().eq('id', id)
    setDeletingId(null)
    load()
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    setDeletingId(id)
    await db.from('personal_expenses').delete().eq('id', id)
    setDeletingId(null)
    load()
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Personal Finance</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Your income and expenses, separate from Craftifyle</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFormMode(formMode === 'income' ? null : 'income')}
            className="flex-1 sm:flex-none text-white text-sm font-medium px-4 py-2 rounded-[10px]"
            style={{ background: 'var(--accent)' }}
          >
            {formMode === 'income' ? 'Cancel' : '+ Add Income'}
          </button>
          <button
            onClick={() => setFormMode(formMode === 'expense' ? null : 'expense')}
            className="flex-1 sm:flex-none text-sm font-medium px-4 py-2 rounded-[10px]"
            style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid var(--danger-muted)' }}
          >
            {formMode === 'expense' ? 'Cancel' : '+ Add Expense'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-xl px-5 py-3 text-sm" style={{ background: 'var(--danger-muted)', border: '1px solid var(--danger-muted)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Add income form */}
      {formMode === 'income' && (
        <EntryForm
          title="New Income Entry"
          color="purple"
          fields={[
            { label: 'Description', key: 'description', placeholder: 'e.g. Tips from Maria wedding' },
            { label: 'Amount (₱)', key: 'amount', type: 'number', placeholder: '1500' },
            { label: 'Date', key: 'income_date', type: 'date' },
            { label: 'Notes', key: 'notes', placeholder: 'Optional' },
          ]}
          selectField={{ label: 'Category', key: 'category', options: INCOME_CATEGORIES }}
          values={incomeForm}
          onChange={(k, v) => setIncomeForm((p) => ({ ...p, [k]: v }))}
          onSubmit={saveIncome}
          saving={saving}
        />
      )}

      {/* Add expense form */}
      {formMode === 'expense' && (
        <EntryForm
          title="New Expense"
          color="red"
          fields={[
            { label: 'Description', key: 'description', placeholder: 'e.g. Gas for delivery' },
            { label: 'Amount (₱)', key: 'amount', type: 'number', placeholder: '500' },
            { label: 'Date', key: 'expense_date', type: 'date' },
            { label: 'Notes', key: 'notes', placeholder: 'Optional' },
          ]}
          selectField={{ label: 'Category', key: 'category', options: EXPENSE_CATEGORIES }}
          values={expenseForm}
          onChange={(k, v) => setExpenseForm((p) => ({ ...p, [k]: v }))}
          onSubmit={saveExpense}
          saving={saving}
        />
      )}

      {/* Year selector */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-sm font-medium mr-1" style={{ color: 'var(--text-muted)' }}>Year:</span>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => {
              setSelectedYear(y)
              setOpenMonth(y === currentYear ? new Date().toISOString().slice(0, 7) : null)
            }}
            className="text-sm px-4 py-1.5 rounded-full font-semibold"
            style={selectedYear === y
              ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
              : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Year summary — dashboard style */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Income" value={peso(yearTotalIncome)} color="purple" />
        <SummaryCard label="Total Expenses" value={peso(yearTotalExpenses)} color="red" />
        <SummaryCard
          label="Net Income"
          value={peso(yearNet)}
          color={yearNet >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          label="Best Month"
          value={bestMonth && bestMonth.net > 0 ? bestMonth.monthLabel : '—'}
          color="indigo"
          sub={bestMonth && bestMonth.net > 0 ? peso(bestMonth.net) : ''}
        />
      </div>

      {/* Monthly accordion */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div className="space-y-2">
          {months.map((month) => {
            const isOpen = openMonth === month.yearMonth
            const hasData = month.income.length > 0 || month.expenses.length > 0
            return (
              <div key={month.yearMonth} className="card overflow-hidden">
                {/* Month header */}
                <button
                  onClick={() => hasData && setOpenMonth(isOpen ? null : month.yearMonth)}
                  disabled={!hasData}
                  className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
                    hasData ? 'cursor-pointer' : 'cursor-default opacity-40'
                  }`}
                  style={hasData ? { ['--hover-c' as string]: 'var(--hover-bg)' } : {}}
                  onMouseEnter={e => hasData && ((e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '')}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-faint)' }}>
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

                {/* Expanded content */}
                {isOpen && hasData && (
                  <div style={{ borderTop: '1px solid var(--card-border)' }}>
                    {/* Income section */}
                    {month.income.length > 0 && (
                      <div>
                        <div className="px-5 py-2" style={{ background: 'var(--accent-subtle)', borderBottom: '1px solid var(--card-border)' }}>
                          <span className="section-label" style={{ color: 'var(--accent-text)' }}>
                            Income — {peso(month.totalIncome)}
                          </span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody>
                            {month.income.map((e) => (
                              <tr key={e.id} style={{ borderTop: '1px solid var(--border-secondary)' }}>
                                <td className="px-5 py-2.5 font-medium" style={{ color: 'var(--text-heading)' }}>{e.description}</td>
                                <td className="px-5 py-2.5 text-xs" style={{ color: 'var(--text-faint)' }}>{fmtDate(e.income_date)}</td>
                                <td className="px-5 py-2.5">
                                  <span className="badge capitalize" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>
                                    {e.category.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5 text-xs" style={{ color: 'var(--text-faint)' }}>{e.notes ?? ''}</td>
                                <td className="px-5 py-2.5 tabular text-right font-bold" style={{ color: 'var(--accent-text)' }}>{peso(e.amount)}</td>
                                <td className="px-5 py-2.5">
                                  <button onClick={() => deleteIncome(e.id)} disabled={deletingId === e.id}
                                    className="text-xs disabled:opacity-50" style={{ color: 'var(--danger)' }}>
                                    {deletingId === e.id ? '…' : 'Del'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Expenses section */}
                    {month.expenses.length > 0 && (
                      <div>
                        <div className="px-5 py-2" style={{ background: 'var(--danger-muted)', borderTop: '1px solid var(--card-border)', borderBottom: '1px solid var(--card-border)' }}>
                          <span className="section-label" style={{ color: 'var(--danger)' }}>
                            Expenses — {peso(month.totalExpenses)}
                          </span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody>
                            {month.expenses.map((e) => (
                              <tr key={e.id} style={{ borderTop: '1px solid var(--border-secondary)' }}>
                                <td className="px-5 py-2.5 font-medium" style={{ color: 'var(--text-heading)' }}>{e.description}</td>
                                <td className="px-5 py-2.5 text-xs" style={{ color: 'var(--text-faint)' }}>{fmtDate(e.expense_date)}</td>
                                <td className="px-5 py-2.5">
                                  <span className="badge capitalize" style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}>
                                    {e.category}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5 text-xs" style={{ color: 'var(--text-faint)' }}>{e.notes ?? ''}</td>
                                <td className="px-5 py-2.5 tabular text-right font-bold" style={{ color: 'var(--danger)' }}>−{peso(e.amount)}</td>
                                <td className="px-5 py-2.5">
                                  <button onClick={() => deleteExpense(e.id)} disabled={deletingId === e.id}
                                    className="text-xs disabled:opacity-50" style={{ color: 'var(--danger)' }}>
                                    {deletingId === e.id ? '…' : 'Del'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Month net total */}
                    <div className="flex items-center justify-between px-5 py-3" style={{ background: 'var(--card-elevated)', borderTop: '1px solid var(--card-border)' }}>
                      <span className="section-label">{month.monthLabel} Net</span>
                      <span className="font-bold tabular" style={{ color: month.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {month.net >= 0 ? '+' : ''}{peso(month.net)}
                      </span>
                    </div>
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

function SummaryCard({
  label, value, color, sub,
}: {
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

function EntryForm({
  title, color, fields, selectField, values, onChange, onSubmit, saving,
}: {
  title: string
  color: 'purple' | 'red'
  fields: { label: string; key: string; placeholder?: string; type?: string }[]
  selectField: { label: string; key: string; options: string[] }
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onSubmit: (e: React.FormEvent) => void
  saving: boolean
}) {
  const isIncome = color === 'purple'
  const accentBg  = isIncome ? 'var(--accent-subtle)'  : 'var(--danger-muted)'
  const accentText = isIncome ? 'var(--accent-text)'   : 'var(--danger)'
  const btnBg     = isIncome ? 'var(--accent)'         : 'var(--danger)'

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: accentBg, border: `1px solid var(--card-border)` }}>
      <h2 className="font-semibold mb-4" style={{ color: accentText }}>{title}</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className={f.key === 'description' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
              <input
                type={f.type ?? 'text'}
                required={f.key === 'description' || f.key === 'amount'}
                value={values[f.key] ?? ''}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{selectField.label}</label>
            <select
              value={values[selectField.key] ?? ''}
              onChange={(e) => onChange(selectField.key, e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
            >
              {selectField.options.map((o) => (
                <option key={o} value={o}>
                  {o.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-[10px]"
          style={{ background: btnBg }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
