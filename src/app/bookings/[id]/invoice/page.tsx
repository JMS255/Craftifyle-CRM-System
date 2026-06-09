'use client'

import { useEffect, useState, use } from 'react'
import { getDocById } from '@/lib/firebase'
import type { Booking, Lead } from '@/types'
import Link from 'next/link'

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const b = await getDocById<Booking>('bookings', id)
      setBooking(b)
      if (b?.lead_id) {
        const l = await getDocById<Lead>('leads', b.lead_id)
        setLead(l)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="p-8 space-y-4 max-w-2xl mx-auto">
      <div className="skeleton h-8 w-48" />
      <div className="card p-6 space-y-3"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-3/4" /><div className="skeleton h-4 w-5/6" /><div className="skeleton h-4 w-2/3" /></div>
    </div>
  )
  if (!booking) return <div className="p-8 text-red-500 text-sm">Booking not found.</div>

  const balance = (booking.package_price ?? 0) - booking.deposit_amount
  const invoiceNumber = `CFY-${booking.created_at.slice(0, 10).replace(/-/g, '')}-${id.slice(0, 4).toUpperCase()}`

  return (
    <div className="invoice-print-root min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Actions (hidden on print) */}
      <div className="max-w-2xl mx-auto mb-4 flex gap-3 print:hidden">
        <Link
          href={`/bookings/${id}`}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Back to Booking
        </Link>
        <button
          onClick={() => window.print()}
          className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          🖨️ Print / Save PDF
        </button>
      </div>

      {/* Invoice */}
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none print:rounded-none">
        {/* Header */}
        <div className="invoice-header bg-slate-900 px-8 py-8" style={{ color: '#ffffff' }}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#ffffff' }}>Craftifyle</h1>
              <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Photobooth & Event Photography</p>
              <p className="text-sm" style={{ color: '#94a3b8' }}>Zamboanga City, Philippines</p>
              <p className="text-sm" style={{ color: '#94a3b8' }}>facebook.com/craftifylePH</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide" style={{ color: '#94a3b8' }}>Invoice</p>
              <p className="font-bold text-lg mt-1" style={{ color: '#ffffff' }}>{invoiceNumber}</p>
              <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Issued: {fmt(booking.created_at)}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          {/* Bill To */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Billed To</p>
            <p className="text-gray-900 font-semibold text-lg">{lead?.name ?? 'Client'}</p>
            {lead?.phone && <p className="text-gray-600 text-sm">{lead.phone}</p>}
            {lead?.email && <p className="text-gray-600 text-sm">{lead.email}</p>}
            {lead?.facebook && <p className="text-gray-600 text-sm">{lead.facebook}</p>}
          </div>

          {/* Event Details */}
          <div className="bg-gray-50 rounded-xl p-5 mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Event Details</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Event</p>
                <p className="text-gray-800 font-medium">{booking.event_name}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Date</p>
                <p className="text-gray-800 font-medium">{fmt(booking.event_date)}</p>
              </div>
              {booking.event_time && (
                <div>
                  <p className="text-gray-400 text-xs">Time</p>
                  <p className="text-gray-800 font-medium">{booking.event_time}</p>
                </div>
              )}
              {booking.venue && (
                <div>
                  <p className="text-gray-400 text-xs">Venue</p>
                  <p className="text-gray-800 font-medium">{booking.venue}</p>
                </div>
              )}
              {lead?.guest_count && (
                <div>
                  <p className="text-gray-400 text-xs">Guests</p>
                  <p className="text-gray-800 font-medium">{lead.guest_count} pax</p>
                </div>
              )}
            </div>
          </div>

          {/* Package / Line Items */}
          {(() => {
            const pkgName = booking.package_name ?? 'Photography/Photobooth Package'
            const parts = pkgName.split(' + ')
            const baseName = parts[0]
            const addons = parts.slice(1)
            const hours = baseName.includes('Premium') ? '4' : '3'
            const basePrice = booking.package_price != null && addons.length > 0
              ? null : (booking.package_price ?? 0)
            return (
              <table className="w-full text-sm mb-8">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs text-gray-400 uppercase pb-2">Description</th>
                    <th className="text-right text-xs text-gray-400 uppercase pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={addons.length > 0 ? '' : 'border-b border-gray-100'}>
                    <td className="py-3">
                      <p className="text-gray-800 font-medium">{baseName}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{hours} hours of coverage · Zamboanga City</p>
                    </td>
                    <td className="py-3 text-right font-medium text-gray-800">
                      {basePrice != null ? `₱${basePrice.toLocaleString()}` : ''}
                    </td>
                  </tr>
                  {addons.map((addon, i) => (
                    <tr key={addon} className={i === addons.length - 1 ? 'border-b border-gray-100' : ''}>
                      <td className="py-2 pl-4">
                        <p className="text-gray-600 text-sm">+ {addon}</p>
                      </td>
                      <td className="py-2 text-right text-gray-500 text-sm"></td>
                    </tr>
                  ))}
                  {addons.length > 0 && (
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-500 text-xs">Package total</td>
                      <td className="py-2 text-right font-semibold text-gray-800">₱{(booking.package_price ?? 0).toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="pt-4 text-gray-500 text-sm">Deposit Paid</td>
                    <td className="pt-4 text-right text-green-600 font-medium">
                      − ₱{booking.deposit_amount.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="pt-2 text-gray-900 font-bold text-base">Balance Due</td>
                    <td className="pt-2 text-right text-gray-900 font-bold text-xl">
                      ₱{balance.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )
          })()}

          {/* Payment Info */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-6">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Payment Details</p>
            <p className="text-sm text-indigo-900">📲 GCash: <span className="font-semibold">0993-632-4512</span></p>
            <p className="text-sm text-indigo-900">Name: <span className="font-semibold">James Ignacio</span></p>
            <p className="text-xs text-indigo-500 mt-2">
              Please send screenshot of payment confirmation to our Facebook page.
            </p>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-600 whitespace-pre-line">{booking.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-100 pt-6 text-center">
            <p className="text-gray-400 text-xs">
              Thank you for choosing Craftifyle! 📸 We&apos;re excited for your event.
            </p>
            <p className="text-gray-300 text-xs mt-1">© 2026 Craftifyle · James Ignacio · Zamboanga City</p>
          </div>
        </div>
      </div>
    </div>
  )
}
