'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Booking, BookingStatus } from '@/types'

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [craftifyleIncome, setCraftifyleIncome] = useState('')
  const [savingIncome, setSavingIncome] = useState(false)

  const db = createClient()

  useEffect(() => {
    db.from('bookings').select('*').eq('id', id).single().then(({ data }) => {
      setBooking(data)
      if (data) {
        setCraftifyleIncome(data.craftifyle_income > 0 ? String(data.craftifyle_income) : '')
      }
      setLoading(false)
    })
  }, [id])

  async function patch(updates: Partial<Booking>) {
    setSaving(true)
    setMsg('')
    const { data, error } = await db
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      setBooking(data)
      setMsg('Saved!')
      setTimeout(() => setMsg(''), 2000)
    }
    setSaving(false)
  }

  async function markDepositPaid() {
    await patch({
      deposit_paid: true,
      deposit_paid_date: new Date().toISOString().slice(0, 10),
    })
  }

  async function markBalancePaid() {
    await patch({
      balance_paid: true,
      balance_paid_date: new Date().toISOString().slice(0, 10),
    })
  }

  async function setStatus(status: BookingStatus) {
    await patch({ status })
  }

  async function saveIncome(e: React.FormEvent) {
    e.preventDefault()
    setSavingIncome(true)
    setMsg('')
    const { data, error } = await db
      .from('bookings')
      .update({
        craftifyle_income: craftifyleIncome ? parseFloat(craftifyleIncome) : 0,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) {
      setMsg('Error: ' + error.message)
    } else {
      setBooking(data)
      setMsg('Income saved!')
      setTimeout(() => setMsg(''), 2000)
    }
    setSavingIncome(false)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (!booking) return <div className="p-8 text-red-500 text-sm">Booking not found.</div>

  const totalPaid =
    (booking.deposit_paid ? booking.deposit_amount : 0) +
    (booking.balance_paid ? booking.balance_amount : 0)
  const totalPrice = booking.package_price ?? 0
  const outstanding = totalPrice - totalPaid

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <Link href="/bookings" className="text-sm text-indigo-600 hover:underline">
            ← Back to Bookings
          </Link>
          <Link
            href={`/bookings/${id}/invoice`}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium"
          >
            🧾 View Invoice
          </Link>
        </div>
        <div className="flex items-start justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{booking.event_name}</h1>
            <p className="text-gray-400 text-sm mt-1">
              {fmt(booking.event_date)}{booking.event_time ? ` · ${booking.event_time}` : ''}
            </p>
          </div>
          <span
            className={`text-sm px-3 py-1 rounded-full font-medium border ${
              booking.status === 'upcoming'
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : booking.status === 'completed'
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-red-100 text-red-700 border-red-200'
            }`}
          >
            {booking.status}
          </span>
        </div>
      </div>

      {msg && (
        <p className={`text-sm mb-4 ${msg.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
          {msg}
        </p>
      )}

      {/* Event Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Event Info</p>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {booking.venue && <Info label="Venue" value={booking.venue} />}
          {booking.package_name && <Info label="Package" value={booking.package_name} />}
          {booking.package_price != null && (
            <Info label="Package Price" value={peso(booking.package_price)} />
          )}
          {booking.lead_id && (
            <div>
              <dt className="text-xs text-gray-400">Source Lead</dt>
              <dd>
                <Link href={`/leads/${booking.lead_id}`} className="text-indigo-600 hover:underline text-sm">
                  View Lead →
                </Link>
              </dd>
            </div>
          )}
          {booking.notes && (
            <div className="col-span-2">
              <dt className="text-xs text-gray-400 mb-1">Notes</dt>
              <dd className="text-gray-700 whitespace-pre-line">{booking.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Payment Tracking */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Payment</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Deposit</p>
              <p className="text-lg font-bold text-gray-900">{peso(booking.deposit_amount)}</p>
              {booking.deposit_paid_date && (
                <p className="text-xs text-gray-400">Paid {fmt(booking.deposit_paid_date)}</p>
              )}
            </div>
            {booking.deposit_paid ? (
              <span className="text-green-600 text-sm font-medium">✓ Paid</span>
            ) : (
              <button
                onClick={markDepositPaid}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Mark Paid
              </button>
            )}
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Balance</p>
              <p className="text-lg font-bold text-gray-900">{peso(booking.balance_amount)}</p>
              {booking.balance_paid_date && (
                <p className="text-xs text-gray-400">Paid {fmt(booking.balance_paid_date)}</p>
              )}
            </div>
            {booking.balance_paid ? (
              <span className="text-green-600 text-sm font-medium">✓ Paid</span>
            ) : (
              <button
                onClick={markBalancePaid}
                disabled={saving || !booking.deposit_paid}
                title={!booking.deposit_paid ? 'Mark deposit paid first' : ''}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Mark Paid
              </button>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-600">Outstanding</p>
            <p className={`text-lg font-bold ${outstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {outstanding > 0 ? peso(outstanding) : 'Fully Paid ✓'}
            </p>
          </div>
        </div>
      </div>

      {/* Craftifyle Income */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Craftifyle Income</p>
        <p className="text-xs text-gray-400 mb-4">How much of this booking counts as Craftifyle business income.</p>

        <div className="bg-blue-50 rounded-lg p-4 mb-4 text-center">
          <p className="text-xs text-blue-500 font-medium mb-1">Craftifyle Income</p>
          <p className="text-2xl font-bold text-blue-700">
            {booking.craftifyle_income > 0 ? peso(booking.craftifyle_income) : '—'}
          </p>
        </div>

        <form onSubmit={saveIncome} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₱)</label>
            <input
              type="number"
              value={craftifyleIncome}
              onChange={(e) => setCraftifyleIncome(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingIncome}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {savingIncome ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>

      {/* Status Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Event Status</p>
        <div className="flex gap-2">
          {(['upcoming', 'completed', 'cancelled'] as BookingStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              disabled={saving || booking.status === s}
              className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors capitalize ${
                booking.status === s
                  ? s === 'upcoming'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : s === 'completed'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-red-600 text-white border-red-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-gray-800 font-medium">{value}</dd>
    </div>
  )
}
