'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Lead, Booking, LeadStatus } from '@/types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  })
}

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

interface MonthStats {
  yearMonth: string
  monthLabel: string
  total: number
  new: number
  contacted: number
  quoted: number
  negotiating: number
  booked: number
  lost: number
  completed: number
  conversionRate: number
}

function buildMonthStats(leads: Lead[], year: string): MonthStats[] {
  const map = new Map<string, Lead[]>()
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    map.set(key, [])
  }
  for (const l of leads) {
    if (!l.created_at.startsWith(year)) continue
    const key = l.created_at.slice(0, 7)
    map.get(key)?.push(l)
  }

  return Array.from(map.entries())
    .map(([yearMonth, items]) => {
      const monthNum = parseInt(yearMonth.split('-')[1]) - 1
      const booked = items.filter((l) => l.status === 'booked' || l.status === 'completed').length
      return {
        yearMonth,
        monthLabel: MONTH_NAMES[monthNum],
        total: items.length,
        new: items.filter((l) => l.status === 'new').length,
        contacted: items.filter((l) => l.status === 'contacted').length,
        quoted: items.filter((l) => l.status === 'quoted').length,
        negotiating: items.filter((l) => l.status === 'negotiating').length,
        booked,
        lost: items.filter((l) => l.status === 'lost').length,
        completed: items.filter((l) => l.status === 'completed').length,
        conversionRate: items.length > 0 ? Math.round((booked / items.length) * 100) : 0,
      }
    })
    .filter((m) => {
      const now = new Date()
      const [y, mo] = m.yearMonth.split('-').map(Number)
      if (y < now.getFullYear()) return m.total > 0
      return mo <= now.getMonth() + 1
    })
    .reverse()
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()))
  const [openMonth, setOpenMonth] = useState<string | null>(
    new Date().toISOString().slice(0, 7)
  )

  useEffect(() => {
    const db = createClient()
    Promise.all([
      db.from('leads').select('*').order('created_at', { ascending: false }),
      db
        .from('bookings')
        .select('*')
        .eq('status', 'upcoming')
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .order('event_date')
        .limit(6),
    ]).then(([{ data: l }, { data: b }]) => {
      setLeads(l ?? [])
      setBookings(b ?? [])
      setLoading(false)
    })
  }, [])

  const years = Array.from(new Set(leads.map((l) => l.created_at.slice(0, 4)))).sort(
    (a, b) => b.localeCompare(a)
  )
  const currentYear = String(new Date().getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const monthStats = buildMonthStats(leads, selectedYear)

  const yearLeads = leads.filter((l) => l.created_at.startsWith(selectedYear))
  const yearBooked = yearLeads.filter((l) => l.status === 'booked' || l.status === 'completed').length
  const yearLost = yearLeads.filter((l) => l.status === 'lost').length
  const yearConvRate = yearLeads.length > 0 ? Math.round((yearBooked / yearLeads.length) * 100) : 0

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">How your business is doing, month by month.</p>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
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
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Year summary — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Leads" value={yearLeads.length} color="indigo" />
        <StatCard label="Converted" value={yearBooked} color="green" />
        <StatCard label="Lost" value={yearLost} color="red" />
        <StatCard label="Conv. Rate" value={`${yearConvRate}%`} color="yellow" />
      </div>

      {/* Main content — stacks on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Monthly lead breakdown — full width on mobile, 2/3 on desktop */}
        <section className="md:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-3">Leads by Month</h2>
          {monthStats.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              No leads for {selectedYear} yet.{' '}
              <Link href="/leads/new" className="text-indigo-600 hover:underline">Add one →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {monthStats.map((m) => {
                const isOpen = openMonth === m.yearMonth
                const hasData = m.total > 0
                return (
                  <div key={m.yearMonth} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => hasData && setOpenMonth(isOpen ? null : m.yearMonth)}
                      disabled={!hasData}
                      className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors ${
                        hasData ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs text-gray-400 shrink-0 inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                          {hasData ? '▶' : '—'}
                        </span>
                        <span className="font-semibold text-gray-800 w-20 shrink-0">{m.monthLabel}</span>
                        {hasData ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                              {m.total} leads
                            </span>
                            {m.booked > 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                {m.booked} booked
                              </span>
                            )}
                            {m.lost > 0 && (
                              <span className="hidden sm:inline text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                {m.lost} lost
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">No leads</span>
                        )}
                      </div>
                      {hasData && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                          m.conversionRate >= 50
                            ? 'bg-green-100 text-green-700'
                            : m.conversionRate >= 20
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {m.conversionRate}%
                        </span>
                      )}
                    </button>

                    {isOpen && hasData && (
                      <div className="border-t border-gray-100 px-4 py-4">
                        <div className="flex rounded-full overflow-hidden h-2 mb-4">
                          <BarSegment count={m.booked} total={m.total} color="bg-green-400" />
                          <BarSegment count={m.negotiating} total={m.total} color="bg-purple-400" />
                          <BarSegment count={m.quoted} total={m.total} color="bg-orange-400" />
                          <BarSegment count={m.contacted} total={m.total} color="bg-yellow-400" />
                          <BarSegment count={m.new} total={m.total} color="bg-blue-300" />
                          <BarSegment count={m.lost} total={m.total} color="bg-red-300" />
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <MiniStat label="New" value={m.new} dot="bg-blue-400" />
                          <MiniStat label="Contacted" value={m.contacted} dot="bg-yellow-400" />
                          <MiniStat label="Quoted" value={m.quoted} dot="bg-orange-400" />
                          <MiniStat label="Negotiating" value={m.negotiating} dot="bg-purple-400" />
                          <MiniStat label="Booked" value={m.booked} dot="bg-green-500" />
                          <MiniStat label="Lost" value={m.lost} dot="bg-red-400" />
                        </div>

                        <Link
                          href={`/leads?year=${selectedYear}&month=${m.yearMonth}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          View all {m.monthLabel} leads →
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Upcoming bookings — full width on mobile, 1/3 on desktop */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Upcoming Events</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {bookings.length === 0 ? (
              <p className="text-gray-400 text-sm px-5 py-6">No upcoming events.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {bookings.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{b.event_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmt(b.event_date)}</p>
                      </div>
                      <div className="text-right">
                        {b.package_price != null && (
                          <p className="text-xs text-gray-500">{peso(b.package_price)}</p>
                        )}
                        <p className={`text-xs mt-0.5 ${b.balance_paid ? 'text-green-600' : 'text-orange-500'}`}>
                          {b.balance_paid ? 'Paid' : 'Balance due'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-4 py-3 border-t border-gray-100">
              <Link href="/bookings" className="text-xs text-indigo-600 hover:underline">
                View all bookings →
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/leads/new"
              className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              + Add New Lead
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: 'indigo' | 'green' | 'red' | 'yellow' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  )
}

function BarSegment({ count, total, color }: { count: number; total: number; color: string }) {
  if (count === 0) return null
  const pct = (count / total) * 100
  return <div className={`${color} h-full`} style={{ width: `${pct}%` }} />
}

function MiniStat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-bold text-gray-800 ml-auto">{value}</span>
    </div>
  )
}
