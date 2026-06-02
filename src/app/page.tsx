'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { createClient } from '@/lib/supabase'
import type { Lead, Booking } from '@/types'

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
  yearMonth: string; monthLabel: string; total: number; new: number
  contacted: number; quoted: number; negotiating: number
  booked: number; lost: number; completed: number; conversionRate: number
}

function buildMonthStats(leads: Lead[], year: string): MonthStats[] {
  const map = new Map<string, Lead[]>()
  for (let m = 1; m <= 12; m++) map.set(`${year}-${String(m).padStart(2, '0')}`, [])
  for (const l of leads) {
    if (!l.created_at.startsWith(year)) continue
    map.get(l.created_at.slice(0, 7))?.push(l)
  }
  return Array.from(map.entries()).map(([yearMonth, items]) => {
    const monthNum = parseInt(yearMonth.split('-')[1]) - 1
    const booked = items.filter(l => l.status === 'booked' || l.status === 'completed').length
    return {
      yearMonth, monthLabel: MONTH_NAMES[monthNum], total: items.length,
      new: items.filter(l => l.status === 'new').length,
      contacted: items.filter(l => l.status === 'contacted').length,
      quoted: items.filter(l => l.status === 'quoted').length,
      negotiating: items.filter(l => l.status === 'negotiating').length,
      booked, lost: items.filter(l => l.status === 'lost').length,
      completed: items.filter(l => l.status === 'completed').length,
      conversionRate: items.length > 0 ? Math.round((booked / items.length) * 100) : 0,
    }
  }).filter(m => {
    const now = new Date()
    const [y, mo] = m.yearMonth.split('-').map(Number)
    if (y < now.getFullYear()) return m.total > 0
    return mo <= now.getMonth() + 1
  }).reverse()
}

interface RevenueStats { confirmed: number; collected: number; pipeline: number; bookingCount: number }

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [revenue, setRevenue] = useState<RevenueStats>({ confirmed: 0, collected: 0, pipeline: 0, bookingCount: 0 })
  const [firstName, setFirstName] = useState('there')
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()))
  const [openMonth, setOpenMonth] = useState<string | null>(new Date().toISOString().slice(0, 7))

  function reload() {
    setLoading(true)
    const db = createClient()
    const now = new Date()
    const thisMonth = now.toISOString().slice(0, 7)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)
    Promise.all([
      db.from('leads').select('*').order('created_at', { ascending: false }),
      db.from('bookings').select('*').eq('status', 'upcoming')
        .gte('event_date', now.toISOString().slice(0, 10)).order('event_date').limit(6),
      db.from('bookings')
        .select('package_price, deposit_amount, deposit_paid, balance_amount, balance_paid, status')
        .gte('event_date', `${thisMonth}-01`).lt('event_date', nextMonth).neq('status', 'cancelled'),
      db.auth.getUser(),
    ]).then(([{ data: l }, { data: b }, { data: rev }, { data: { user } }]) => {
      setLeads(l ?? [])
      setBookings(b ?? [])
      const confirmed = (rev ?? []).reduce((s, r) => s + (r.package_price ?? 0), 0)
      const collected = (rev ?? []).reduce((s, r) => {
        let c = 0
        if (r.deposit_paid) c += r.deposit_amount ?? 0
        if (r.balance_paid) c += r.balance_amount ?? 0
        return s + c
      }, 0)
      setRevenue({ confirmed, collected, pipeline: confirmed - collected, bookingCount: (rev ?? []).length })
      if (user) {
        db.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => {
          const name = data?.full_name?.split(' ')[0]
          if (name) setFirstName(name)
        })
      }
      setLoading(false)
    })
  }

  useEffect(() => { reload() }, [])

  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const todayStr = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const years = Array.from(new Set(leads.map(l => l.created_at.slice(0, 4)))).sort((a, b) => b.localeCompare(a))
  const currentYear = String(new Date().getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const monthStats = buildMonthStats(leads, selectedYear)
  const yearLeads = leads.filter(l => l.created_at.startsWith(selectedYear))
  const yearBooked = yearLeads.filter(l => l.status === 'booked' || l.status === 'completed').length
  const yearLost = yearLeads.filter(l => l.status === 'lost').length
  const yearConvRate = yearLeads.length > 0 ? Math.round((yearBooked / yearLeads.length) * 100) : 0

  const now = Date.now()
  const todayActions = leads
    .filter(l => !['booked', 'completed', 'lost'].includes(l.status))
    .map(l => {
      const eventMs = l.event_date ? new Date(l.event_date).getTime() : null
      const daysToEvent = eventMs != null ? Math.floor((eventMs - now) / 86400000) : null
      const daysSilent = Math.floor((now - new Date(l.updated_at).getTime()) / 86400000)
      let urgency = 0; let action = ''; let color = '#6b7280'
      if (daysToEvent != null && daysToEvent < 0) { urgency = 100; action = 'Event passed — close it'; color = '#f87171' }
      else if (daysToEvent != null && daysToEvent <= 3) { urgency = 90; action = `Event in ${daysToEvent}d — confirm now!`; color = '#fb923c' }
      else if (daysToEvent != null && daysToEvent <= 7) { urgency = 75; action = `Event in ${daysToEvent}d — follow up`; color = '#fbbf24' }
      else if (['quoted', 'negotiating'].includes(l.status) && daysSilent >= 7) { urgency = 60; action = `${daysSilent}d quiet — send follow-up`; color = '#a78bfa' }
      else if (l.status === 'new' && daysSilent >= 3) { urgency = 40; action = `${daysSilent}d old — first contact`; color = '#818cf8' }
      return { ...l, urgency, action, color }
    })
    .filter(l => l.urgency >= 40)
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 3)

  const balanceDueAlerts = bookings.filter(b => {
    const daysToEvent = Math.floor((new Date(b.event_date).getTime() - now) / 86400000)
    return daysToEvent >= 0 && daysToEvent <= 7 && !b.balance_paid && b.balance_amount > 0
  })

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-5">
        <div className="skeleton h-10 w-56 mb-2" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="skeleton h-44 rounded-2xl" />
          <div className="skeleton h-44 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-heading)' }}>
            Good {timeOfDay}, {firstName} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>{todayStr}</p>
        </div>
        <Link
          href="/leads/new"
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          + New Lead
        </Link>
      </div>

      {/* ── Welcome flow — shown when user has zero leads ── */}
      {leads.length === 0 && <WelcomeFlow onComplete={reload} />}
      {leads.length > 0 && <OnboardingChecklist />}

      {/* ── Revenue hero strip ── */}
      {revenue.bookingCount > 0 && (
        <div
          className="rounded-2xl p-4 mb-5 grid grid-cols-3 gap-3"
          style={{
            background: 'linear-gradient(135deg, var(--money-muted) 0%, var(--accent-subtle) 100%)',
            border: '1px solid var(--card-border)',
          }}
        >
          <div>
            <p className="section-label mb-2">Confirmed</p>
            <HeroMoney amount={revenue.confirmed} />
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
              {revenue.bookingCount} booking{revenue.bookingCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div>
            <p className="section-label mb-2">Collected</p>
            <HeroMoney amount={revenue.collected} color="var(--success)" />
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>received</p>
          </div>
          <div>
            <p className="section-label mb-2">Outstanding</p>
            <HeroMoney amount={revenue.pipeline} color={revenue.pipeline > 0 ? 'var(--money)' : 'var(--success)'} />
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>balance due</p>
          </div>
        </div>
      )}

      {/* ── Today's Actions ── */}
      {todayActions.length > 0 ? (
        <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-secondary)' }}>
            <p className="section-label">Today's Actions</p>
          </div>
          {todayActions.map((l, i) => (
            <Link key={l.id} href={`/leads/${l.id}`}
              className="flex items-center justify-between px-5 py-3.5 transition-colors"
              style={{
                borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
                borderLeft: `3px solid ${l.color}`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: l.color + '22', color: l.color }}
                >
                  {l.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{l.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {l.event_type ?? l.status}{l.event_date ? ` · ${fmt(l.event_date)}` : ''}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold shrink-0 ml-3" style={{ color: l.color }}>
                {l.action} →
              </span>
            </Link>
          ))}
        </div>
      ) : leads.length > 0 && (
        <div className="rounded-2xl px-5 py-4 mb-5 flex items-center gap-3"
          style={{ background: 'var(--success-muted)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <span className="text-lg">🎉</span>
          <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
            Nothing urgent right now — you're on top of everything.
          </p>
        </div>
      )}

      {/* ── Balance Due This Week ── */}
      {balanceDueAlerts.length > 0 && (
        <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: 'var(--card)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-secondary)', background: 'rgba(245,158,11,0.06)' }}>
            <p className="section-label" style={{ color: 'var(--money)' }}>💰 Balance Due This Week</p>
          </div>
          {balanceDueAlerts.map((b, i) => {
            const daysToEvent = Math.floor((new Date(b.event_date).getTime() - now) / 86400000)
            const when = daysToEvent === 0 ? 'Today' : daysToEvent === 1 ? 'Tomorrow' : `In ${daysToEvent} days`
            return (
              <Link key={b.id} href={`/bookings/${b.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors"
                style={{ borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{b.event_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{when} · {fmt(b.event_date)}</p>
                </div>
                <span className="text-sm font-bold ml-3 shrink-0" style={{ color: 'var(--money)' }}>
                  {peso(b.balance_amount)} due →
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Pipeline + Upcoming Events ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <PipelineSnapshot leads={leads} />
        <UpcomingEvents bookings={bookings} />
      </div>

      {/* ── Quick chips ── */}
      <div className="flex gap-2 flex-wrap mb-8">
        {[
          { label: '📋 Paste DM', prompt: 'Parse this client inquiry and create a lead: ', mode: 'crm' },
          { label: '⚡ What needs attention?', prompt: 'What needs my attention today?', mode: 'crm' },
          { label: '💰 Revenue this month', prompt: 'How much revenue do I have this month?', mode: 'crm' },
          { label: '✍️ Draft follow-up', prompt: 'Help me draft a follow-up message for a client who went quiet', mode: 'advisor' },
        ].map(chip => (
          <button key={chip.label}
            onClick={() => window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: chip }))}
            className="text-xs px-3 py-1.5 rounded-full font-medium"
            style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* ── Trends (bottom) ── */}
      {yearLeads.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: '2rem' }}>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <h2 className="section-label">Trends</h2>
              <div className="flex gap-1.5">
                {[
                  { label: `${yearLeads.length} leads`, color: 'var(--accent-text)', bg: 'var(--accent-subtle)' },
                  { label: `${yearBooked} booked`, color: 'var(--success)', bg: 'var(--success-muted)' },
                  { label: `${yearConvRate}% conv.`, color: 'var(--warning)', bg: 'var(--warning-muted)' },
                ].map(s => (
                  <span key={s.label} className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5">
              {years.map(y => (
                <button key={y}
                  onClick={() => { setSelectedYear(y); setOpenMonth(y === currentYear ? new Date().toISOString().slice(0, 7) : null) }}
                  className="text-xs px-3 py-1 rounded-full font-medium"
                  style={selectedYear === y
                    ? { background: 'var(--accent-subtle2)', color: 'var(--accent-text)', border: '1px solid var(--accent)' }
                    : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div className="card p-5">
              <p className="section-label mb-4">Bookings per Month</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={buildMonthStats(leads, selectedYear).reverse()} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(0, 3)} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-faint)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-heading)', fontWeight: 600 }} itemStyle={{ color: 'var(--success)' }} formatter={v => [v, 'Booked']} />
                  <Bar dataKey="booked" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <p className="section-label mb-4">Lead Sources</p>
              <SourceDonut leads={yearLeads} />
            </div>
          </div>

          {/* Monthly accordion */}
          <h2 className="section-label mb-3">Leads by Month</h2>
          <div className="space-y-2">
            {monthStats.map(m => {
              const isOpen = openMonth === m.yearMonth
              const hasData = m.total > 0
              return (
                <div key={m.yearMonth} className="rounded-2xl overflow-hidden transition-all"
                  style={{ background: 'var(--card)', border: `1px solid ${isOpen ? 'var(--card-border-active)' : 'var(--card-border)'}` }}>
                  <button onClick={() => hasData && setOpenMonth(isOpen ? null : m.yearMonth)} disabled={!hasData}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                    style={{ opacity: hasData ? 1 : 0.3 }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs inline-block transition-transform" style={{ color: 'var(--text-faint)', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                        {hasData ? '▶' : '—'}
                      </span>
                      <span className="font-semibold w-20 shrink-0" style={{ color: 'var(--text-heading)' }}>{m.monthLabel}</span>
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
                          background: m.conversionRate >= 50 ? 'rgba(16,185,129,0.15)' : m.conversionRate >= 20 ? 'rgba(245,158,11,0.15)' : 'var(--subtle-bg)',
                          color: m.conversionRate >= 50 ? '#34d399' : m.conversionRate >= 20 ? '#fbbf24' : 'var(--text-muted)',
                        }}>{m.conversionRate}%</span>
                    )}
                  </button>
                  {isOpen && hasData && (
                    <div className="border-t px-4 py-4" style={{ borderColor: 'var(--card-border)' }}>
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
                        className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                        View all {m.monthLabel} leads →
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pipeline Snapshot ──────────────────────────────────────────
function PipelineSnapshot({ leads }: { leads: Lead[] }) {
  const active = leads.filter(l => !['lost', 'completed'].includes(l.status))
  const total = active.length
  const stages = [
    { key: 'new',          label: 'New',          color: '#3b82f6' },
    { key: 'contacted',    label: 'Contacted',    color: '#6366f1' },
    { key: 'quoted',       label: 'Quoted',       color: '#f59e0b' },
    { key: 'negotiating',  label: 'Negotiating',  color: '#8b5cf6' },
    { key: 'booked',       label: 'Booked',       color: '#10b981' },
  ]
  const counts = stages.map(s => ({ ...s, count: active.filter(l => l.status === s.key).length }))

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="section-label">Pipeline</p>
        <Link href="/leads" className="text-xs" style={{ color: 'var(--accent-text)' }}>
          View all →
        </Link>
      </div>
      {total === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No active leads.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl font-bold tabular" style={{ color: 'var(--text-heading)' }}>{total}</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>active leads</span>
          </div>
          {/* Segmented bar */}
          <div className="flex rounded-full overflow-hidden mb-4" style={{ height: '6px', gap: '2px', background: 'var(--subtle-bg)' }}>
            {counts.map(s => s.count > 0 && (
              <div key={s.key} style={{ width: `${(s.count / total) * 100}%`, background: s.color, borderRadius: '9999px' }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {counts.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                <span className="text-xs font-bold tabular" style={{ color: s.count > 0 ? 'var(--text-heading)' : 'var(--text-faint)' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Upcoming Events ────────────────────────────────────────────
function UpcomingEvents({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-secondary)' }}>
        <p className="section-label">Upcoming Events</p>
      </div>
      {bookings.length === 0 ? (
        <p className="text-sm px-5 py-6 flex-1" style={{ color: 'var(--text-faint)' }}>No upcoming events.</p>
      ) : (
        <ul className="flex-1">
          {bookings.map((b, i) => (
            <li key={b.id} style={{ borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
              <Link href={`/bookings/${b.id}`}
                className="flex items-center justify-between px-5 py-3.5 transition-colors"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex flex-col items-center justify-center shrink-0 text-center"
                    style={{ background: 'var(--accent-subtle)' }}>
                    <span className="text-[9px] font-bold uppercase leading-none" style={{ color: 'var(--accent-text)' }}>
                      {new Date(b.event_date).toLocaleDateString('en-PH', { month: 'short' })}
                    </span>
                    <span className="text-sm font-bold leading-none mt-0.5" style={{ color: 'var(--accent-text)' }}>
                      {new Date(b.event_date).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{b.event_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      {b.package_name ?? 'No package'}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {b.package_price != null && (
                    <p className="text-sm font-bold tabular" style={{ color: 'var(--money)' }}>
                      {peso(b.package_price)}
                    </p>
                  )}
                  <p className="text-xs mt-0.5 font-medium" style={{ color: b.balance_paid ? 'var(--success)' : 'var(--warning)' }}>
                    {b.balance_paid ? '✓ Paid' : 'Balance due'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 py-2.5" style={{ borderTop: '1px solid var(--border-secondary)' }}>
        <Link href="/bookings" className="text-xs" style={{ color: 'var(--accent-text)' }}>View all bookings →</Link>
      </div>
    </div>
  )
}

// ── HeroMoney — abbreviated KPI (₱27.1k) that fits any screen ─
function fmtAbbrev(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toLocaleString('en-PH')
}
function HeroMoney({ amount, color = 'var(--money)' }: { amount: number; color?: string }) {
  return (
    <div className="flex items-baseline gap-0.5 leading-none">
      <span className="font-semibold" style={{ fontSize: '0.9rem', color, opacity: 0.6 }}>₱</span>
      <span className="font-bold tabular" style={{ fontSize: '3rem', lineHeight: 1, color }}>
        {fmtAbbrev(amount)}
      </span>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────
function Chip({ label, color }: { label: string; color: 'indigo' | 'green' | 'red' }) {
  const styles = {
    indigo: { background: 'rgba(99,102,241,0.15)', color: '#818cf8' },
    green:  { background: 'rgba(16,185,129,0.15)', color: '#34d399' },
    red:    { background: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  }
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={styles[color]}>{label}</span>
}

function BarSeg({ count, total, color }: { count: number; total: number; color: string }) {
  if (count === 0) return null
  return <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, background: color }} />
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-xs font-bold ml-auto tabular" style={{ color: 'var(--text-heading)' }}>{value}</span>
    </div>
  )
}

// ── WelcomeFlow — first-login experience ───────────────────────
function WelcomeFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'paste' | 'processing' | 'done'>('paste')
  const [dm, setDm] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [skipped, setSkipped] = useState(() => localStorage.getItem('craftifyle-welcomed') === '1')

  async function handleParse() {
    if (!dm.trim()) return
    setStep('processing')
    setError('')
    try {
      const res = await fetch('/api/crafty-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Parse this client inquiry and create a lead: ${dm.trim()}` }],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReply(data.reply ?? 'Done — Lead created!')
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setStep('paste')
    }
  }

  function finish() {
    localStorage.setItem('craftifyle-welcomed', '1')
    onComplete()
  }

  if (skipped) return null

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {step === 'paste' && (
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5"
              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--card-border)' }}>
              👋
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>
              Welcome to Crafty CRM
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Let's create your first lead in under 2 minutes.<br />
              Paste a client inquiry from Messenger below.
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 animate-pulse"
              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--card-border)' }}>
              🤖
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>
              Crafty is reading your DM…
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Extracting client name, event details, and contact info.
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5"
              style={{ background: 'var(--success-muted)', border: '1px solid rgba(74,222,128,0.2)' }}>
              🎉
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>
              Your first lead is organized!
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Crafty extracted the details and added the client to your pipeline.
            </p>
          </div>
        )}

        <div className="card p-6">

          {step === 'paste' && (
            <>
              <p className="section-label mb-3">Paste a Messenger DM</p>
              <textarea
                value={dm}
                onChange={e => setDm(e.target.value)}
                rows={5}
                placeholder={'e.g.\n"Hi! Available po ba kayo July 4? Birthday ng anak ko, 80 guests. Gusto namin ng photobooth. Magkano po?"'}
                className="w-full rounded-xl px-4 py-3 text-sm resize-none mb-4"
                autoFocus
              />
              {error && <p className="text-xs mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}
              <button onClick={handleParse} disabled={!dm.trim()}
                className="w-full py-3 rounded-[10px] text-sm font-semibold text-white disabled:opacity-40 mb-3"
                style={{ background: 'var(--accent)' }}>
                🤖 Let Crafty Parse This
              </button>
              <div className="flex items-center gap-3">
                <Link href="/leads/new"
                  className="flex-1 py-2.5 rounded-[10px] text-sm font-medium text-center"
                  style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                  Add lead manually
                </Link>
                <button onClick={() => { setSkipped(true); localStorage.setItem('craftifyle-welcomed', '1') }}
                  className="flex-1 py-2.5 rounded-[10px] text-sm"
                  style={{ color: 'var(--text-faint)' }}>
                  Skip for now
                </button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: 'var(--accent)', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Reading your DM…</p>
            </div>
          )}

          {step === 'done' && (
            <>
              <div className="rounded-xl px-4 py-4 mb-5"
                style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-heading)' }}>
                  {reply}
                </p>
              </div>
              <button onClick={finish}
                className="w-full py-3 rounded-[10px] text-sm font-semibold text-white mb-3"
                style={{ background: 'var(--accent)' }}>
                View my dashboard →
              </button>
              <Link href="/leads"
                className="block w-full text-center py-2.5 rounded-[10px] text-sm font-medium"
                style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                Go to Leads
              </Link>
            </>
          )}
        </div>

        {step === 'paste' && (
          <p className="text-center text-xs mt-4" style={{ color: 'var(--text-faint)' }}>
            Crafty reads the DM and extracts client details automatically. Nothing is sent to the client.
          </p>
        )}
      </div>
    </div>
  )
}

function OnboardingChecklist() {
  const steps = [
    { id: 'lead',   label: 'Add your first lead',  desc: 'Paste a Messenger DM or add manually', href: '/leads/new', icon: '📋' },
    { id: 'crafty', label: 'Try Crafty AI',         desc: 'Click the 🤖 button and ask anything',  href: null,         icon: '🤖' },
    { id: 'profile',label: 'Set up your profile',  desc: 'Add your business name and location',   href: '/profile',   icon: '👤' },
  ]
  const [done, setDone] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('onboarding-done') || '[]') } catch { return [] }
  })
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('onboarding-dismissed') === '1')

  const allDone = steps.every(s => done.includes(s.id))

  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => {
        setDismissed(true)
        localStorage.setItem('onboarding-dismissed', '1')
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [allDone])

  function markDone(id: string) {
    const next = [...new Set([...done, id])]
    setDone(next)
    localStorage.setItem('onboarding-done', JSON.stringify(next))
  }
  function dismiss() { setDismissed(true); localStorage.setItem('onboarding-dismissed', '1') }

  if (dismissed) return null

  return (
    <div className="rounded-2xl p-5 mb-6 relative"
      style={{ background: 'linear-gradient(135deg, rgba(124,111,247,0.08), rgba(139,92,246,0.06))', border: '1px solid rgba(124,111,247,0.25)' }}>
      <button onClick={dismiss} className="absolute top-4 right-4 text-xs opacity-40 hover:opacity-100" style={{ color: 'var(--text-faint)' }}>✕</button>
      <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-heading)' }}>
        {allDone ? '🎉 You\'re all set!' : 'Welcome to Crafty CRM — let\'s get started!'}
      </p>
      <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>
        {allDone ? 'Your CRM is ready. Start adding leads!' : 'Complete these 3 steps to get the most out of Crafty.'}
      </p>
      <div className="h-1 rounded-full mb-4 overflow-hidden" style={{ background: 'var(--subtle-bg)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(done.length / steps.length) * 100}%`, background: 'var(--accent)' }} />
      </div>
      <div className="space-y-2">
        {steps.map(s => {
          const isDone = done.includes(s.id)
          const content = (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
              style={{ background: isDone ? 'rgba(16,185,129,0.08)' : 'var(--card)', border: `1px solid ${isDone ? 'rgba(16,185,129,0.2)' : 'var(--card-border)'}` }}>
              <span className="text-lg shrink-0">{isDone ? '✅' : s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: isDone ? '#34d399' : 'var(--text-heading)', textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.7 : 1 }}>{s.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{s.desc}</p>
              </div>
              {!isDone && <span className="text-xs" style={{ color: 'var(--accent-text)' }}>→</span>}
            </div>
          )
          if (s.href) return <Link key={s.id} href={s.href} onClick={() => markDone(s.id)}>{content}</Link>
          return <button key={s.id} className="w-full text-left" onClick={() => { markDone(s.id); window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: { prompt: 'Hi Crafty!', mode: 'advisor' } })) }}>{content}</button>
        })}
      </div>
    </div>
  )
}

const SOURCE_COLORS: Record<string, string> = {
  facebook: '#6366f1', instagram: '#ec4899', referral: '#10b981',
  website: '#f59e0b', tiktok: '#06b6d4', 'walk-in': '#8b5cf6', other: '#6b7280',
}

function SourceDonut({ leads }: { leads: Lead[] }) {
  const counts: Record<string, number> = {}
  for (const l of leads) counts[l.source] = (counts[l.source] ?? 0) + 1
  const data = Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  if (!data.length) return <p className="text-xs text-center py-10" style={{ color: 'var(--text-faint)' }}>No data yet</p>
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
          {data.map(entry => <Cell key={entry.name} fill={SOURCE_COLORS[entry.name] ?? '#6b7280'} />)}
        </Pie>
        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }}
          itemStyle={{ color: 'var(--text-heading)' }} formatter={(v, name) => [v, name]} />
      </PieChart>
    </ResponsiveContainer>
  )
}
