'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Booking, BookingStatus } from '@/types'

const STATUSES: BookingStatus[] = ['upcoming', 'completed', 'cancelled']

function fmtMonthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-')
  return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-PH', {
    month: 'long',
  })
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtShort(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  })
}

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

interface MonthGroup {
  yearMonth: string
  bookings: Booking[]
  totalRevenue: number
  collected: number
  craftifyleIncome: number
}

function groupByMonth(bookings: Booking[]): MonthGroup[] {
  const map = new Map<string, Booking[]>()
  for (const b of bookings) {
    const key = b.event_date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(b)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([yearMonth, items]) => {
      const active = items.filter((b) => b.status !== 'cancelled')
      return {
        yearMonth,
        bookings: items,
        totalRevenue: active.reduce((s, b) => s + (b.package_price ?? 0), 0),
        collected: active.reduce(
          (s, b) =>
            s +
            (b.deposit_paid ? b.deposit_amount : 0) +
            (b.balance_paid ? b.balance_amount : 0),
          0
        ),
        craftifyleIncome: active.reduce((s, b) => s + (b.craftifyle_income ?? 0), 0),
      }
    })
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()))

  useEffect(() => {
    const db = createClient()
    db.from('bookings')
      .select('*')
      .order('event_date', { ascending: false })
      .then(({ data }) => {
        setBookings(data ?? [])
        setLoading(false)
      })
  }, [])

  const years = Array.from(
    new Set(bookings.map((b) => b.event_date.slice(0, 4)))
  ).sort((a, b) => b.localeCompare(a))

  const currentYear = String(new Date().getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const yearBookings = bookings.filter((b) => b.event_date.startsWith(selectedYear))
  const statusFiltered =
    statusFilter === 'all' ? yearBookings : yearBookings.filter((b) => b.status === statusFilter)
  const months = groupByMonth(statusFiltered)

  const yearActive = yearBookings.filter((b) => b.status !== 'cancelled')
  const yearRevenue = yearActive.reduce((s, b) => s + (b.package_price ?? 0), 0)
  const yearCollected = yearActive.reduce(
    (s, b) =>
      s +
      (b.deposit_paid ? b.deposit_amount : 0) +
      (b.balance_paid ? b.balance_amount : 0),
    0
  )
  const yearCraftifyle = yearActive.reduce((s, b) => s + (b.craftifyle_income ?? 0), 0)

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-gray-500 text-sm mt-0.5">All confirmed events</p>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-gray-500 font-medium mr-1">Year:</span>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`text-sm px-4 py-1.5 rounded-full border font-semibold transition-colors ${
              selectedYear === y
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Year summary cards — 1 col mobile, 3 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <SummaryCard label={`${selectedYear} Revenue`} value={peso(yearRevenue)} color="indigo" />
        <SummaryCard label="Collected" value={peso(yearCollected)} color="green" />
        <SummaryCard label="Craftifyle Income" value={peso(yearCraftifyle)} color="blue" />
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(['all', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-sm px-4 py-1.5 rounded-full border font-medium transition-colors capitalize ${
              statusFilter === s
                ? 'bg-slate-700 text-white border-slate-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : months.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No bookings for {selectedYear}.</p>
          <p className="text-gray-400 text-sm mt-2">Convert a lead to create a booking.</p>
        </div>
      ) : (
        <MonthAccordion months={months} year={selectedYear} />
      )}
    </div>
  )
}

function MonthAccordion({ months, year }: { months: MonthGroup[]; year: string }) {
  const currentYearMonth = new Date().toISOString().slice(0, 7)
  const [open, setOpen] = useState<string | null>(
    months.some((m) => m.yearMonth === currentYearMonth)
      ? currentYearMonth
      : (months[0]?.yearMonth ?? null)
  )

  return (
    <div className="space-y-2">
      {months.map((month) => {
        const isOpen = open === month.yearMonth
        return (
          <div key={month.yearMonth} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Accordion header */}
            <button
              onClick={() => setOpen(isOpen ? null : month.yearMonth)}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-xs text-gray-400 transition-transform inline-block shrink-0 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                <span className="font-semibold text-gray-800 shrink-0">{fmtMonthLabel(month.yearMonth)} {year}</span>
                <span className="text-xs text-gray-400 hidden sm:inline">
                  {month.bookings.filter((b) => b.status !== 'cancelled').length} event
                  {month.bookings.filter((b) => b.status !== 'cancelled').length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm shrink-0">
                <span className="text-blue-600 font-medium text-xs hidden sm:inline">
                  {peso(month.craftifyleIncome)} <span className="text-blue-400 font-normal">Craftifyle</span>
                </span>
                <span className="text-indigo-700 font-bold text-sm">{peso(month.totalRevenue)}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100">
                {/* Desktop table */}
                <table className="hidden md:table w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-5 py-3">Event</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Package</th>
                      <th className="px-5 py-3">Deposit</th>
                      <th className="px-5 py-3">Balance</th>
                      <th className="px-5 py-3">Craftifyle</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {month.bookings.map((b) => (
                      <tr
                        key={b.id}
                        className={`hover:bg-gray-50 transition-colors ${b.status === 'cancelled' ? 'opacity-40' : ''}`}
                      >
                        <td className="px-5 py-3">
                          <Link href={`/bookings/${b.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                            {b.event_name}
                          </Link>
                          {b.venue && <p className="text-xs text-gray-400">{b.venue}</p>}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {fmt(b.event_date)}
                          {b.event_time && <p className="text-xs text-gray-400">{b.event_time}</p>}
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          <p>{b.package_name ?? '—'}</p>
                          {b.package_price != null && <p className="text-xs text-gray-400">{peso(b.package_price)}</p>}
                        </td>
                        <td className="px-5 py-3"><PayCell amount={b.deposit_amount} paid={b.deposit_paid} /></td>
                        <td className="px-5 py-3"><PayCell amount={b.balance_amount} paid={b.balance_paid} /></td>
                        <td className="px-5 py-3 text-blue-700 font-medium">
                          {b.craftifyle_income ? peso(b.craftifyle_income) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-gray-50">
                  {month.bookings.map((b) => (
                    <Link
                      key={b.id}
                      href={`/bookings/${b.id}`}
                      className={`flex items-start justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${b.status === 'cancelled' ? 'opacity-40' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{b.event_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtShort(b.event_date)}{b.venue ? ` · ${b.venue}` : ''}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {b.package_name && (
                            <span className="text-xs text-gray-500">{b.package_name}</span>
                          )}
                          {b.craftifyle_income ? (
                            <span className="text-xs text-blue-600 font-medium">{peso(b.craftifyle_income)} Craftifyle</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className={b.deposit_paid ? 'text-green-600' : 'text-orange-500'}>
                            Deposit {b.deposit_paid ? '✓' : '⋯'}
                          </span>
                          <span className={b.balance_paid ? 'text-green-600' : 'text-orange-500'}>
                            Balance {b.balance_paid ? '✓' : '⋯'}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right ml-3">
                        {b.package_price != null && (
                          <p className="text-sm font-bold text-indigo-700">{peso(b.package_price)}</p>
                        )}
                        <StatusBadge status={b.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: 'indigo' | 'green' | 'blue' | 'purple' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  )
}

function PayCell({ amount, paid }: { amount: number; paid: boolean }) {
  if (amount <= 0) return <span className="text-gray-300 text-xs">—</span>
  return (
    <div>
      <p className="text-gray-800">{peso(amount)}</p>
      <p className={`text-xs ${paid ? 'text-green-600' : 'text-orange-500'}`}>
        {paid ? '✓ Paid' : 'Pending'}
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    upcoming: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}
