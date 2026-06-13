'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WelcomeCard from '@/components/WelcomeCard'
import { auth, getDocsByUser } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import type { Booking, BookingStatus } from '@/types'
import TopBar from '@/components/TopBar'

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
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { setLoading(false); return }
      unsub()
      getDocsByUser<Booking>('bookings', user.uid)
        .then(data => {
          setBookings([...data].filter(b => b.event_date).sort((a, b) => b.event_date.localeCompare(a.event_date)))
          setLoading(false)
        })
        .catch(() => setLoading(false))
      // Silently backfill any fully-paid bookings missing from personal finance
      fetch('/api/bookings/sync-finance', { method: 'POST' }).catch(err => {
        import('@sentry/nextjs').then(({ captureException }) => captureException(err))
      })
    })
    return () => unsub()
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

  const today = new Date().toISOString().slice(0, 10)
  const overdueBookings = yearBookings.filter(
    (b) => b.status === 'upcoming' && b.event_date < today && !b.balance_paid
  )

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
    <>
      <TopBar page="Bookings" title="Bookings" subtitle="All confirmed events" />
      <div className="p-4 md:p-8">
      <WelcomeCard
        storageKey="welcome-bookings"
        icon="📅"
        title="Your Bookings Hub"
        description="Every confirmed event in one place — organized by month so you always know what's coming up."
        tips={[
          'Track deposit & balance payments per booking',
          'See overdue balances highlighted automatically',
          'Use the year selector to review past revenue',
        ]}
        accentColor="#3b82f6"
      />
      {/* Year selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-medium mr-1" style={{ color: 'var(--text-muted)' }}>Year:</span>
        {years.map((y) => (
          <button key={y} onClick={() => setSelectedYear(y)}
            className="text-xs px-3 py-1.5 rounded-full font-semibold"
            style={selectedYear === y
              ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
              : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
            {y}
          </button>
        ))}
      </div>

      {/* Overdue alert */}
      {!loading && overdueBookings.length > 0 && (
        <div className="mb-4 rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: '#f87171' }}>
            ⚠ {overdueBookings.length} booking{overdueBookings.length !== 1 ? 's' : ''} overdue — event passed, balance unpaid
          </p>
          <div className="space-y-1.5">
            {overdueBookings.map(b => (
              <Link key={b.id} href={`/bookings/${b.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>{b.event_name}</span>
                  <span className="text-xs ml-2" style={{ color: 'var(--text-faint)' }}>{fmtShort(b.event_date)}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: '#f87171' }}>{peso(b.balance_amount)} due →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Year summary cards — 1 col mobile, 3 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <SummaryCard label={`${selectedYear} Revenue`} value={peso(yearRevenue)} color="indigo" />
        <SummaryCard label="Collected" value={peso(yearCollected)} color="green" />
        <SummaryCard label="Craftifyle Income" value={peso(yearCraftifyle)} color="blue" />
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {(['all', ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="text-xs px-3 py-1.5 rounded-full font-medium capitalize"
            style={statusFilter === s
              ? { background: 'var(--card-elevated)', color: 'var(--text-heading)', border: '1px solid var(--card-border-active)' }
              : { background: 'transparent', color: 'var(--text-faint)', border: '1px solid var(--card-border)' }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="skeleton h-4 w-28" />
                <div className="skeleton h-4 w-20" />
              </div>
              {[...Array(2)].map((_, j) => (
                <div key={j} className="flex items-center gap-4 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-secondary)' }}>
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-4 w-24 ml-auto" />
                  <div className="skeleton h-4 w-20" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : months.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="text-4xl mb-3">◈</div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>No bookings for {selectedYear} yet.</p>
          <p className="text-sm mb-5" style={{ color: 'var(--text-faint)' }}>
            When a lead confirms, convert them to a booking from their lead page — or ask Crafty to do it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: { prompt: 'Convert a lead to a booking: ', mode: 'crm' } }))}
              className="px-5 py-2.5 rounded-[10px] text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              ⚡ Ask Crafty to convert a lead
            </button>
            <Link href="/leads" className="px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
              View Leads →
            </Link>
          </div>
        </div>
      ) : (
        <MonthAccordion months={months} year={selectedYear} />
      )}
    </div>
  </>
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
          <div key={month.yearMonth} className="card overflow-hidden">
            {/* Accordion header */}
            <button
              onClick={() => setOpen(isOpen ? null : month.yearMonth)}
              className="w-full flex items-center justify-between px-4 py-4 text-left transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-xs transition-transform inline-block shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                style={{ color: 'var(--text-faint)' }}>▶</span>
                <span className="font-semibold shrink-0" style={{ color: 'var(--text-heading)' }}>{fmtMonthLabel(month.yearMonth)} {year}</span>
                <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-faint)' }}>
                  {month.bookings.filter((b) => b.status !== 'cancelled').length} event
                  {month.bookings.filter((b) => b.status !== 'cancelled').length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-medium hidden sm:inline" style={{ color: 'var(--accent-text)' }}>
                  {peso(month.craftifyleIncome)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>income</span>
                </span>
                <span className="text-sm font-bold tabular" style={{ color: 'var(--money)' }}>{peso(month.totalRevenue)}</span>
              </div>
            </button>

            <div style={{
              overflow: 'hidden',
              maxHeight: isOpen ? '2000px' : '0',
              opacity: isOpen ? 1 : 0,
              transition: isOpen
                ? 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease 0.05s'
                : 'max-height 0.22s cubic-bezier(0.4,0,0.6,1), opacity 0.15s ease',
            }}>
              <div style={{ borderTop: '1px solid var(--border-secondary)' }}>
                {/* Desktop table */}
                <table className="hidden md:table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Package</th>
                      <th>Deposit</th>
                      <th>Balance</th>
                      <th>Craftifyle</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody style={{ borderTop: '1px solid var(--border-secondary)' }}>
                    {month.bookings.map((b) => (
                      <tr
                        key={b.id}
                        className={b.status === 'cancelled' ? 'opacity-40' : ''}
                        style={{ borderBottom: '1px solid var(--border-secondary)' }}
                      >
                        <td className="px-5 py-3">
                          <Link href={`/bookings/${b.id}`} className="font-medium hover:underline" style={{ color: 'var(--text-heading)' }}>
                            {b.event_name}
                          </Link>
                          {b.venue && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{b.venue}</p>}
                        </td>
                        <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                          {fmt(b.event_date)}
                          {b.event_time && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{b.event_time}</p>}
                        </td>
                        <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                          <p>{b.package_name ?? '—'}</p>
                          {b.package_price != null && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{peso(b.package_price)}</p>}
                        </td>
                        <td className="px-5 py-3"><PayCell amount={b.deposit_amount} paid={b.deposit_paid} /></td>
                        <td className="px-5 py-3"><PayCell amount={b.balance_amount} paid={b.balance_paid} /></td>
                        <td className="px-5 py-3 font-medium tabular" style={{ color: 'var(--accent-text)' }}>
                          {b.craftifyle_income ? peso(b.craftifyle_income) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={b.status} />
                          <div className="mt-1"><PaymentBadge booking={b} /></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile cards */}
                <div className="md:hidden" style={{ borderTop: '1px solid var(--border-secondary)' }}>
                  {month.bookings.map((b) => (
                    <Link
                      key={b.id}
                      href={`/bookings/${b.id}`}
                      className={`flex items-start justify-between px-4 py-4 transition-colors ${b.status === 'cancelled' ? 'opacity-40' : ''}`}
                      style={{ borderBottom: '1px solid var(--border-secondary)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-heading)' }}>{b.event_name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{fmtShort(b.event_date)}{b.venue ? ` · ${b.venue}` : ''}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {b.package_name && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.package_name}</span>
                          )}
                          {b.craftifyle_income ? (
                            <span className="text-xs font-medium" style={{ color: 'var(--accent-text)' }}>{peso(b.craftifyle_income)} income</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span style={{ color: b.deposit_paid ? 'var(--success)' : 'var(--warning)' }}>
                            Deposit {b.deposit_paid ? '✓' : '⋯'}
                          </span>
                          <span style={{ color: b.balance_paid ? 'var(--success)' : 'var(--warning)' }}>
                            Balance {b.balance_paid ? '✓' : '⋯'}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right ml-3">
                        {b.package_price != null && (
                          <p className="text-sm font-bold tabular" style={{ color: 'var(--money)' }}>{peso(b.package_price)}</p>
                        )}
                        <StatusBadge status={b.status} />
                        <div className="mt-1"><PaymentBadge booking={b} /></div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: 'indigo' | 'green' | 'blue' | 'purple' }) {
  const colors = {
    indigo: { bg: 'var(--money-muted)',   text: 'var(--money)' },
    green:  { bg: 'var(--success-muted)', text: 'var(--success)' },
    blue:   { bg: 'var(--accent-subtle)', text: 'var(--accent-text)' },
    purple: { bg: 'rgba(139,92,246,0.1)',  text: '#a78bfa' },
  }
  return (
    <div className="rounded-xl p-4" style={{ background: colors[color].bg }}>
      <p className="text-xl font-bold" style={{ color: colors[color].text }}>{value}</p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

function PayCell({ amount, paid }: { amount: number; paid: boolean }) {
  if (amount <= 0) return <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
  return (
    <div>
      <p className="tabular" style={{ color: 'var(--text-heading)' }}>{peso(amount)}</p>
      <p className="text-xs" style={{ color: paid ? '#34d399' : '#f59e0b' }}>{paid ? '✓ Paid' : 'Pending'}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, { bg: string; color: string }> = {
    upcoming:  { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    completed: { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
    cancelled: { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
  }
  return (
    <span className="text-xs px-2 py-1 rounded-full font-medium"
      style={{ background: styles[status].bg, color: styles[status].color }}>
      {status}
    </span>
  )
}

function PaymentBadge({ booking }: { booking: Booking }) {
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = booking.status === 'upcoming' && booking.event_date < today && !booking.balance_paid

  if (isOverdue) return (
    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>⚠ Overdue</span>
  )
  if (booking.balance_paid && booking.deposit_paid) return (
    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>✓ Fully Paid</span>
  )
  if (booking.deposit_paid) return (
    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>Deposit Paid</span>
  )
  return (
    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>Unpaid</span>
  )
}
