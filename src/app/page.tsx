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
  return new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
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
  const [openMonth, setOpenMonth] = useState<string | null>(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    const db = createClient()
    Promise.all([
      db.from('leads').select('*').order('created_at', { ascending: false }),
      db.from('bookings').select('*').eq('status', 'upcoming')
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .order('event_date').limit(6),
    ]).then(([{ data: l }, { data: b }]) => {
      setLeads(l ?? [])
      setBookings(b ?? [])
      setLoading(false)
    })
  }, [])

  const years = Array.from(new Set(leads.map((l) => l.created_at.slice(0, 4)))).sort((a, b) => b.localeCompare(a))
  const currentYear = String(new Date().getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const monthStats = buildMonthStats(leads, selectedYear)
  const yearLeads = leads.filter((l) => l.created_at.startsWith(selectedYear))
  const yearBooked = yearLeads.filter((l) => l.status === 'booked' || l.status === 'completed').length
  const yearLost = yearLeads.filter((l) => l.status === 'lost').length
  const yearConvRate = yearLeads.length > 0 ? Math.round((yearBooked / yearLeads.length) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3" style={{ color: '#4a4a6a' }}>
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#6366f1' }} />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#4a4a6a' }}>
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Link
          href="/leads/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          + New Lead
        </Link>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => {
              setSelectedYear(y)
              setOpenMonth(y === currentYear ? new Date().toISOString().slice(0, 7) : null)
            }}
            className="text-sm px-4 py-1.5 rounded-full font-medium transition-all"
            style={{
              background: selectedYear === y ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              color: selectedYear === y ? '#a5b4fc' : '#6b7280',
              border: `1px solid ${selectedYear === y ? '#6366f1' : '#1e1e2e'}`,
            }}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Leads" value={yearLeads.length} gradient="from-indigo-500 to-violet-600" icon="◎" />
        <StatCard label="Converted" value={yearBooked} gradient="from-emerald-500 to-teal-600" icon="✓" />
        <StatCard label="Lost" value={yearLost} gradient="from-red-500 to-rose-600" icon="✕" />
        <StatCard label="Conv. Rate" value={`${yearConvRate}%`} gradient="from-amber-500 to-orange-600" icon="%" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Monthly breakdown */}
        <section className="md:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#4a4a6a' }}>
            Leads by Month
          </h2>
          {monthStats.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
              <p className="text-sm" style={{ color: '#4a4a6a' }}>No leads for {selectedYear} yet. <Link href="/leads/new" className="text-indigo-400 hover:underline">Add one →</Link></p>
            </div>
          ) : (
            <div className="space-y-2">
              {monthStats.map((m) => {
                const isOpen = openMonth === m.yearMonth
                const hasData = m.total > 0
                return (
                  <div key={m.yearMonth} className="rounded-2xl overflow-hidden transition-all"
                    style={{ background: '#111118', border: `1px solid ${isOpen ? '#2a2a4a' : '#1e1e2e'}` }}>
                    <button
                      onClick={() => hasData && setOpenMonth(isOpen ? null : m.yearMonth)}
                      disabled={!hasData}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors"
                      style={{ opacity: hasData ? 1 : 0.3 }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs transition-transform inline-block" style={{ color: '#4a4a6a', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                          {hasData ? '▶' : '—'}
                        </span>
                        <span className="font-semibold text-white w-20 shrink-0">{m.monthLabel}</span>
                        {hasData && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Chip label={`${m.total} leads`} color="indigo" />
                            {m.booked > 0 && <Chip label={`${m.booked} booked`} color="green" />}
                            {m.lost > 0 && <Chip label={`${m.lost} lost`} color="red" />}
                          </div>
                        )}
                      </div>
                      {hasData && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ml-2"
                          style={{
                            background: m.conversionRate >= 50 ? 'rgba(16,185,129,0.15)' : m.conversionRate >= 20 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                            color: m.conversionRate >= 50 ? '#34d399' : m.conversionRate >= 20 ? '#fbbf24' : '#6b7280',
                          }}>
                          {m.conversionRate}%
                        </span>
                      )}
                    </button>

                    {isOpen && hasData && (
                      <div className="border-t px-4 py-4" style={{ borderColor: '#1e1e2e' }}>
                        <div className="flex rounded-full overflow-hidden h-1.5 mb-4 gap-0.5">
                          <BarSeg count={m.booked} total={m.total} color="#10b981" />
                          <BarSeg count={m.negotiating} total={m.total} color="#8b5cf6" />
                          <BarSeg count={m.quoted} total={m.total} color="#f59e0b" />
                          <BarSeg count={m.contacted} total={m.total} color="#6366f1" />
                          <BarSeg count={m.new} total={m.total} color="#3b82f6" />
                          <BarSeg count={m.lost} total={m.total} color="#ef4444" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <MiniStat label="New" value={m.new} color="#3b82f6" />
                          <MiniStat label="Contacted" value={m.contacted} color="#6366f1" />
                          <MiniStat label="Quoted" value={m.quoted} color="#f59e0b" />
                          <MiniStat label="Negotiating" value={m.negotiating} color="#8b5cf6" />
                          <MiniStat label="Booked" value={m.booked} color="#10b981" />
                          <MiniStat label="Lost" value={m.lost} color="#ef4444" />
                        </div>
                        <Link href={`/leads?year=${selectedYear}&month=${m.yearMonth}`}
                          className="text-xs hover:underline" style={{ color: '#6366f1' }}>
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

        {/* Upcoming events */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#4a4a6a' }}>
            Upcoming Events
          </h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
            {bookings.length === 0 ? (
              <p className="text-sm px-5 py-6" style={{ color: '#4a4a6a' }}>No upcoming events.</p>
            ) : (
              <ul>
                {bookings.map((b, i) => (
                  <li key={b.id} style={{ borderTop: i > 0 ? '1px solid #1a1a28' : 'none' }}>
                    <Link href={`/bookings/${b.id}`}
                      className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-white/[0.02]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0"
                          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                          📸
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{b.event_name}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#4a4a6a' }}>{fmt(b.event_date)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        {b.package_price != null && (
                          <p className="text-xs font-medium" style={{ color: '#9ca3af' }}>{peso(b.package_price)}</p>
                        )}
                        <p className="text-xs mt-0.5" style={{ color: b.balance_paid ? '#10b981' : '#f59e0b' }}>
                          {b.balance_paid ? '✓ Paid' : 'Balance due'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-4 py-3 border-t" style={{ borderColor: '#1a1a28' }}>
              <Link href="/bookings" className="text-xs hover:underline" style={{ color: '#6366f1' }}>
                View all bookings →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, gradient, icon }: { label: string; value: number | string; gradient: string; icon: string }) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden"
      style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 blur-2xl"
        style={{ background: gradient.includes('indigo') ? '#6366f1' : gradient.includes('emerald') ? '#10b981' : gradient.includes('red') ? '#ef4444' : '#f59e0b', transform: 'translate(30%, -30%)' }} />
      <p className="text-2xl md:text-3xl font-bold text-white">{value}</p>
      <p className="text-xs mt-1.5 font-medium" style={{ color: '#4a4a6a' }}>{label}</p>
    </div>
  )
}

function Chip({ label, color }: { label: string; color: 'indigo' | 'green' | 'red' }) {
  const styles = {
    indigo: { background: 'rgba(99,102,241,0.15)', color: '#818cf8' },
    green: { background: 'rgba(16,185,129,0.15)', color: '#34d399' },
    red: { background: 'rgba(239,68,68,0.15)', color: '#f87171' },
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={styles[color]}>
      {label}
    </span>
  )
}

function BarSeg({ count, total, color }: { count: number; total: number; color: string }) {
  if (count === 0) return null
  return <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, background: color }} />
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs" style={{ color: '#6b7280' }}>{label}</span>
      <span className="text-xs font-bold text-white ml-auto">{value}</span>
    </div>
  )
}
