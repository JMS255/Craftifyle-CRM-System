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
    const { error: err } = await db.from('personal_income').insert({
      description: incomeForm.description.trim(),
      amount: parseFloat(incomeForm.amount),
      income_date: incomeForm.income_date,
      category: incomeForm.category,
      notes: incomeForm.notes || null,
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
    const { error: err } = await db.from('personal_expenses').insert({
      description: expenseForm.description.trim(),
      amount: parseFloat(expenseForm.amount),
      expense_date: expenseForm.expense_date,
      category: expenseForm.category,
      notes: expenseForm.notes || null,
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Personal Finance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Your income and expenses, separate from Craftifyle</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFormMode(formMode === 'income' ? null : 'income')}
            className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {formMode === 'income' ? 'Cancel' : '+ Add Income'}
          </button>
          <button
            onClick={() => setFormMode(formMode === 'expense' ? null : 'expense')}
            className="flex-1 sm:flex-none bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {formMode === 'expense' ? 'Cancel' : '+ Add Expense'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700">
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
        <span className="text-sm text-gray-500 font-medium mr-1">Year:</span>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => {
              setSelectedYear(y)
              setOpenMonth(y === currentYear ? new Date().toISOString().slice(0, 7) : null)
            }}
            className={`text-sm px-4 py-1.5 rounded-full border font-semibold transition-colors ${
              selectedYear === y
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-gray-200 text-gray-500 hover:border-purple-400 hover:text-purple-600'
            }`}
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
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="space-y-2">
          {months.map((month) => {
            const isOpen = openMonth === month.yearMonth
            const hasData = month.income.length > 0 || month.expenses.length > 0
            return (
              <div key={month.yearMonth} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Month header */}
                <button
                  onClick={() => hasData && setOpenMonth(isOpen ? null : month.yearMonth)}
                  disabled={!hasData}
                  className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
                    hasData ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs text-gray-400 inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                      {hasData ? '▶' : '—'}
                    </span>
                    <span className="font-semibold text-gray-800 w-24">{month.monthLabel}</span>
                    {hasData ? (
                      <div className="flex gap-3 text-xs">
                        <span className="text-purple-600 font-medium">+{peso(month.totalIncome)}</span>
                        {month.totalExpenses > 0 && (
                          <span className="text-red-500 font-medium">−{peso(month.totalExpenses)}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">No entries</span>
                    )}
                  </div>
                  {hasData && (
                    <span className={`text-sm font-bold ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {month.net >= 0 ? '+' : ''}{peso(month.net)} net
                    </span>
                  )}
                </button>

                {/* Expanded content */}
                {isOpen && hasData && (
                  <div className="border-t border-gray-100">
                    {/* Income section */}
                    {month.income.length > 0 && (
                      <div>
                        <div className="px-5 py-2 bg-purple-50 border-b border-purple-100">
                          <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                            Income — {peso(month.totalIncome)}
                          </span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-gray-50">
                            {month.income.map((e) => (
                              <tr key={e.id} className="hover:bg-gray-50">
                                <td className="px-5 py-2.5 font-medium text-gray-900">{e.description}</td>
                                <td className="px-5 py-2.5 text-gray-400 text-xs">{fmtDate(e.income_date)}</td>
                                <td className="px-5 py-2.5">
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full capitalize">
                                    {e.category.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5 text-gray-400 text-xs">{e.notes ?? ''}</td>
                                <td className="px-5 py-2.5 text-right font-bold text-purple-700">{peso(e.amount)}</td>
                                <td className="px-5 py-2.5">
                                  <button onClick={() => deleteIncome(e.id)} disabled={deletingId === e.id}
                                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
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
                        <div className="px-5 py-2 bg-red-50 border-y border-red-100">
                          <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                            Expenses — {peso(month.totalExpenses)}
                          </span>
                        </div>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-gray-50">
                            {month.expenses.map((e) => (
                              <tr key={e.id} className="hover:bg-gray-50">
                                <td className="px-5 py-2.5 font-medium text-gray-900">{e.description}</td>
                                <td className="px-5 py-2.5 text-gray-400 text-xs">{fmtDate(e.expense_date)}</td>
                                <td className="px-5 py-2.5">
                                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full capitalize">
                                    {e.category}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5 text-gray-400 text-xs">{e.notes ?? ''}</td>
                                <td className="px-5 py-2.5 text-right font-bold text-red-600">−{peso(e.amount)}</td>
                                <td className="px-5 py-2.5">
                                  <button onClick={() => deleteExpense(e.id)} disabled={deletingId === e.id}
                                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
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
                    <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-200">
                      <span className="text-xs font-semibold text-gray-500">{month.monthLabel} Net</span>
                      <span className={`font-bold ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
  const colors = {
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
      <p className="text-sm mt-1 opacity-80">{label}</p>
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
  const bg = color === 'purple' ? 'bg-purple-50 border-purple-200' : 'bg-red-50 border-red-200'
  const ring = color === 'purple' ? 'focus:ring-purple-500' : 'focus:ring-red-400'
  const btn = color === 'purple' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-red-500 hover:bg-red-600'
  const heading = color === 'purple' ? 'text-purple-900' : 'text-red-800'

  return (
    <div className={`border rounded-xl p-5 mb-6 ${bg}`}>
      <h2 className={`font-semibold mb-4 ${heading}`}>{title}</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className={f.key === 'description' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input
                type={f.type ?? 'text'}
                required={f.key === 'description' || f.key === 'amount'}
                value={values[f.key] ?? ''}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
                className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{selectField.label}</label>
            <select
              value={values[selectField.key] ?? ''}
              onChange={(e) => onChange(selectField.key, e.target.value)}
              className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`}
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
          className={`${btn} disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors`}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
