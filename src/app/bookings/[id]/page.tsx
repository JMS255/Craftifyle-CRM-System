'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { getDocById, updateDocument } from '@/lib/firebase'
import type { Booking, BookingStatus } from '@/types'

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

const STATUS_STYLE: Record<BookingStatus, { color: string; bg: string }> = {
  upcoming:  { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  completed: { color: '#34d399', bg: 'rgba(16,185,129,0.12)' },
  cancelled: { color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [justPaid, setJustPaid] = useState<'deposit' | 'balance' | null>(null)
  const [craftifyleIncome, setCraftifyleIncome] = useState('')
  const [savingIncome, setSavingIncome] = useState(false)
  const [syncingCal, setSyncingCal] = useState(false)
  const [calMsg, setCalMsg] = useState('')
  const [payLink, setPayLink] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [contractCopied, setContractCopied] = useState(false)

  function copyConfirmLink() {
    const token = btoa(id).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    navigator.clipboard.writeText(`${window.location.origin}/confirm/${token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    getDocById<Booking>('bookings', id).then(data => {
      setBooking(data)
      if (data) {
        setCraftifyleIncome(data.craftifyle_income > 0 ? String(data.craftifyle_income) : '')
        setPayLink(data.paymongo_link_url ?? null)
      }
      setLoading(false)
    })
  }, [id])

  async function generatePayLink() {
    if (!booking) return
    setGeneratingLink(true)
    const isDepositUnpaid = !booking.deposit_paid
    const amount = isDepositUnpaid ? booking.deposit_amount : booking.balance_amount
    const description = `${isDepositUnpaid ? 'Deposit' : 'Balance'} — ${booking.event_name}`
    const res = await fetch('/api/paymongo/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id, amount, description }),
    })
    const data = await res.json()
    if (data.linkUrl) {
      setPayLink(data.linkUrl)
      setBooking(prev => prev ? { ...prev, paymongo_link_url: data.linkUrl, paymongo_link_id: data.linkId } : prev)
    } else {
      setMsg(data.error ?? 'Failed to generate link — check PayMongo setup.')
    }
    setGeneratingLink(false)
  }

  function copyContractLink() {
    const token = btoa(id).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    navigator.clipboard.writeText(`${window.location.origin}/contract/${token}`)
    setContractCopied(true)
    setTimeout(() => setContractCopied(false), 2000)
  }

  function copyPayLink() {
    if (!payLink) return
    navigator.clipboard.writeText(payLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function markDepositPaid() {
    const today = new Date().toISOString().slice(0, 10)
    setBooking(prev => prev ? { ...prev, deposit_paid: true, deposit_paid_date: today } : prev)
    setJustPaid('deposit'); setTimeout(() => setJustPaid(null), 2500)
    try {
      await updateDocument('bookings', id, { deposit_paid: true, deposit_paid_date: today })
    } catch {
      setBooking(prev => prev ? { ...prev, deposit_paid: false, deposit_paid_date: null } : prev)
      setMsg('Error — try again.'); setJustPaid(null)
    }
  }
  async function markBalancePaid() {
    const today = new Date().toISOString().slice(0, 10)
    setBooking(prev => prev ? { ...prev, balance_paid: true, balance_paid_date: today } : prev)
    setJustPaid('balance'); setTimeout(() => setJustPaid(null), 2500)
    try {
      await updateDocument('bookings', id, { balance_paid: true, balance_paid_date: today })
    } catch {
      setBooking(prev => prev ? { ...prev, balance_paid: false, balance_paid_date: null } : prev)
      setMsg('Error — try again.'); setJustPaid(null)
    }
  }
  async function setStatus(status: BookingStatus) {
    const prev = booking?.status
    setBooking(b => b ? { ...b, status } : b)
    try {
      await updateDocument('bookings', id, { status })
    } catch {
      if (prev) { setBooking(b => b ? { ...b, status: prev } : b); setMsg('Error — try again.') }
    }
  }
  async function saveIncome(e: React.FormEvent) {
    e.preventDefault(); setSavingIncome(true); setMsg('')
    try {
      const income = craftifyleIncome ? parseFloat(craftifyleIncome) : 0
      await updateDocument('bookings', id, { craftifyle_income: income })
      setBooking(prev => prev ? { ...prev, craftifyle_income: income } : prev)
      setMsg('Income saved!'); setTimeout(() => setMsg(''), 2000)
    } catch (err: unknown) {
      setMsg('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
    setSavingIncome(false)
  }
  async function syncCalendar() {
    setSyncingCal(true); setCalMsg('')
    const res = await fetch('/api/bookings/sync-calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: id }) })
    const data = await res.json()
    if (data.ok) {
      setCalMsg(booking?.gcal_event_id ? '✅ Calendar updated!' : '✅ Added to Google Calendar!')
      getDocById<Booking>('bookings', id).then(b => { if (b) setBooking(b) })
    } else { setCalMsg('❌ Sync failed') }
    setSyncingCal(false); setTimeout(() => setCalMsg(''), 3000)
  }

  if (loading) return (
    <div className="p-4 md:p-8 max-w-3xl md:max-w-none space-y-4">
      <div className="skeleton h-8 w-52" />
      <div className="skeleton h-32 w-full rounded-2xl" />
      <div className="card p-6 space-y-3"><div className="skeleton h-5 w-64" /><div className="skeleton h-4 w-40" /><div className="skeleton h-4 w-56" /></div>
      <div className="card p-6 space-y-3"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-3/4" /></div>
    </div>
  )
  if (!booking) return <div className="p-8 text-sm" style={{ color: 'var(--danger)' }}>Booking not found.</div>

  const totalPaid = (booking.deposit_paid ? booking.deposit_amount : 0) + (booking.balance_paid ? booking.balance_amount : 0)
  const totalPrice = booking.package_price ?? 0
  const outstanding = totalPrice - totalPaid
  const paidPct = totalPrice > 0 ? Math.round((totalPaid / totalPrice) * 100) : 0
  const ss = STATUS_STYLE[booking.status]

  return (
    <div className="p-4 md:p-8 max-w-3xl md:max-w-none">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/bookings" className="text-sm" style={{ color: 'var(--accent-text)' }}>← Bookings</Link>
        <span style={{ color: 'var(--text-faint)' }}>/</span>
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{booking.event_name}</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {calMsg && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{calMsg}</span>}
          <button onClick={syncCalendar} disabled={syncingCal}
            className="text-xs px-3 py-1.5 rounded-[10px] font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--success)' }}>
            {syncingCal ? 'Syncing…' : booking.gcal_event_id ? '📅 Update Cal' : '📅 Add to Cal'}
          </button>
          <button onClick={copyConfirmLink}
            className="text-xs px-3 py-1.5 rounded-[10px] font-medium"
            style={{ background: copied ? 'var(--success-muted)' : 'var(--subtle-bg)', color: copied ? 'var(--success)' : 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
            {copied ? '✓ Copied!' : '🔗 Share Link'}
          </button>
          <Link href={`/bookings/${id}/invoice`}
            className="text-xs px-3 py-1.5 rounded-[10px] font-medium text-white"
            style={{ background: 'var(--accent)' }}>
            🧾 Invoice
          </Link>
        </div>
      </div>

      {/* ── Event header card ── */}
      <div className="card p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>{booking.event_name}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
              {fmt(booking.event_date)}{booking.event_time ? ` · ${booking.event_time}` : ''}
              {booking.venue ? ` · ${booking.venue}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="badge capitalize font-semibold px-3 py-1" style={{ background: ss.bg, color: ss.color }}>{booking.status}</span>
            {booking.package_name && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{booking.package_name}</p>
            )}
          </div>
        </div>
        {booking.lead_id && (
          <Link href={`/leads/${booking.lead_id}`} className="inline-flex items-center gap-1 mt-3 text-xs font-medium"
            style={{ color: 'var(--accent-text)' }}>
            View lead →
          </Link>
        )}
        {booking.notes && (
          <p className="text-sm mt-3 pt-3 whitespace-pre-line" style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border-secondary)' }}>
            {booking.notes}
          </p>
        )}
      </div>

      {/* ── Just paid flash ── */}
      {justPaid && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'var(--success-muted)', border: '1px solid rgba(74,222,128,0.2)' }}>
          <span className="text-xl">✅</span>
          <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
            {justPaid === 'deposit' ? 'Deposit marked as paid!' : 'Balance marked as paid! Fully settled ✓'}
          </p>
        </div>
      )}
      {msg && !justPaid && (
        <p className="text-sm mb-4 font-medium" style={{ color: msg.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
          {msg}
        </p>
      )}

      {/* ── Payment card ── */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label">Payment</p>
          {totalPrice > 0 && (
            <span className="text-xs font-bold tabular" style={{ color: outstanding === 0 ? 'var(--success)' : 'var(--warning)' }}>
              {outstanding === 0 ? 'Fully Paid ✓' : `${peso(outstanding)} outstanding`}
            </span>
          )}
        </div>

        {/* Payment progress bar */}
        {totalPrice > 0 && (
          <div className="mb-5">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text-faint)' }}>
              <span>{peso(totalPaid)} paid</span>
              <span>{paidPct}% of {peso(totalPrice)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--subtle-bg)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${paidPct}%`, background: paidPct === 100 ? 'var(--success)' : 'var(--accent)' }} />
            </div>
          </div>
        )}

        {/* Deposit row */}
        <div className="flex items-center justify-between py-3.5"
          style={{ borderBottom: '1px solid var(--border-secondary)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Deposit</p>
            <p className="text-xl font-bold tabular mt-0.5" style={{ color: 'var(--money)' }}>
              {peso(booking.deposit_amount)}
            </p>
            {booking.deposit_paid_date && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Paid {fmt(booking.deposit_paid_date)}</p>
            )}
          </div>
          {booking.deposit_paid ? (
            <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--success)' }}>
              <span>✓</span> Paid
            </div>
          ) : (
            <button onClick={markDepositPaid} disabled={saving}
              className="text-sm font-semibold px-4 py-2 rounded-[10px] text-white disabled:opacity-50"
              style={{ background: 'var(--success)' }}>
              Mark Paid
            </button>
          )}
        </div>

        {/* Balance row */}
        <div className="flex items-center justify-between py-3.5">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>Balance</p>
            <p className="text-xl font-bold tabular mt-0.5" style={{ color: 'var(--money)' }}>
              {peso(booking.balance_amount)}
            </p>
            {booking.balance_paid_date && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>Paid {fmt(booking.balance_paid_date)}</p>
            )}
          </div>
          {booking.balance_paid ? (
            <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--success)' }}>
              <span>✓</span> Paid
            </div>
          ) : (
            <button onClick={markBalancePaid} disabled={saving || !booking.deposit_paid}
              title={!booking.deposit_paid ? 'Mark deposit paid first' : ''}
              className="text-sm font-semibold px-4 py-2 rounded-[10px] text-white disabled:opacity-40"
              style={{ background: 'var(--success)' }}>
              Mark Paid
            </button>
          )}
        </div>
      </div>

      {/* ── Contract ── */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="section-label">Contract</p>
          {booking.contract_signed_at && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'var(--success-muted)', color: 'var(--success)' }}>
              ✓ Signed
            </span>
          )}
        </div>
        {booking.contract_signed_at ? (
          <div className="mt-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Signed by <strong>{booking.contract_signed_name}</strong>
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
              {new Date(booking.contract_signed_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs mb-3" style={{ color: 'var(--text-faint)' }}>
              Not signed yet. Send the contract link to your client.
            </p>
            <button onClick={copyContractLink}
              className="text-sm font-semibold px-4 py-2.5 rounded-[10px] transition-colors"
              style={{
                background: contractCopied ? 'var(--success-muted)' : 'var(--subtle-bg)',
                color: contractCopied ? 'var(--success)' : 'var(--text-heading)',
                border: '1px solid var(--card-border)',
              }}>
              {contractCopied ? '✓ Link Copied!' : '📋 Copy Contract Link'}
            </button>
          </div>
        )}
      </div>

      {/* ── Payment Link ── */}
      {false && (booking!.deposit_paid === false || booking!.balance_paid === false) && (
        <div className="card p-5 mb-5">
          <p className="section-label mb-1">Send Payment Link</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>
            Client pays via GCash, Maya, or card. Deposit is marked paid automatically when they complete payment.
          </p>
          {payLink ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)' }}>
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--accent-text)' }}>{payLink}</span>
                <button onClick={copyPayLink}
                  className="text-xs font-semibold shrink-0 px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: linkCopied ? 'var(--success-muted)' : 'var(--accent-subtle)', color: linkCopied ? 'var(--success)' : 'var(--accent-text)' }}>
                  {linkCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <button onClick={generatePayLink} disabled={generatingLink}
                className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={{ color: 'var(--text-faint)', border: '1px solid var(--card-border)' }}>
                {generatingLink ? 'Generating…' : 'Generate new link'}
              </button>
            </div>
          ) : (
            <button onClick={generatePayLink} disabled={generatingLink}
              className="text-sm font-semibold px-5 py-2.5 rounded-[10px] text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {generatingLink ? 'Generating…' : '💳 Generate Payment Link'}
            </button>
          )}
        </div>
      )}

      {/* ── Craftifyle Income ── */}
      <div className="card p-5 mb-5">
        <p className="section-label mb-1">Craftifyle Income</p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-faint)' }}>
          Business income from this booking (separate from personal).
        </p>
        <div className="rounded-xl p-4 mb-4 text-center"
          style={{ background: 'var(--accent-subtle)', border: '1px solid var(--card-border)' }}>
          <p className="section-label mb-1">Craftifyle Income</p>
          <p className="text-2xl font-bold tabular" style={{ color: 'var(--money)' }}>
            {booking.craftifyle_income > 0 ? peso(booking.craftifyle_income) : '—'}
          </p>
        </div>
        <form onSubmit={saveIncome} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Amount (₱)</label>
            <input type="number" value={craftifyleIncome} onChange={e => setCraftifyleIncome(e.target.value)}
              placeholder="0" className="w-full rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={savingIncome}
            className="text-sm font-semibold px-4 py-2 rounded-[10px] text-white disabled:opacity-50 whitespace-nowrap"
            style={{ background: 'var(--accent)' }}>
            {savingIncome ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>

      {/* ── Event Status ── */}
      <div className="card p-5">
        <p className="section-label mb-3">Event Status</p>
        <div className="flex gap-2 flex-wrap">
          {(['upcoming', 'completed', 'cancelled'] as BookingStatus[]).map(s => {
            const active = booking.status === s
            const st = STATUS_STYLE[s]
            return (
              <button key={s} onClick={() => setStatus(s)} disabled={saving || active}
                className="text-sm px-4 py-2 rounded-[10px] font-medium capitalize"
                style={active
                  ? { background: st.bg, color: st.color, border: `1px solid ${st.color}40` }
                  : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
                {s}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
