import { createAdminClient } from '@/lib/supabase-admin'
import type { Booking } from '@/types'

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Token is base64url(bookingId) — decode it
  let bookingId: string
  try {
    bookingId = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  } catch {
    return <ErrorPage message="Invalid booking link." />
  }

  const db = createAdminClient()
  const { data: booking, error } = await db
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (error || !booking) return <ErrorPage message="Booking not found. Please contact Craftifyle." />

  const b = booking as Booking
  const totalPaid = (b.deposit_paid ? b.deposit_amount : 0) + (b.balance_paid ? b.balance_amount : 0)
  const outstanding = (b.package_price ?? 0) - totalPaid

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-12"
      style={{ background: '#09090f', fontFamily: 'system-ui, sans-serif' }}>
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            📸
          </div>
          <h1 className="text-xl font-bold text-white">Craftifyle</h1>
          <p style={{ color: '#6b7280', fontSize: 13 }}>Booking Confirmation</p>
        </div>

        {/* Booking card */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: '#111118', border: '1px solid #1e1e2e' }}>

          {/* Event header */}
          <div className="px-6 py-5 border-b" style={{ borderColor: '#1e1e2e' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#6366f1' }}>Your Booking</p>
            <h2 className="text-xl font-bold text-white">{b.event_name}</h2>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>{fmt(b.event_date)}</p>
            {b.event_time && <p className="text-sm" style={{ color: '#9ca3af' }}>{b.event_time}</p>}
            {b.venue && <p className="text-sm mt-1" style={{ color: '#6b7280' }}>📍 {b.venue}</p>}
          </div>

          {/* Package */}
          {(b.package_name || b.package_price) && (
            <div className="px-6 py-4 border-b" style={{ borderColor: '#1e1e2e' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>Package</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">{b.package_name ?? 'Service Package'}</p>
                {b.package_price && <p className="text-sm font-bold text-white">{peso(b.package_price)}</p>}
              </div>
            </div>
          )}

          {/* Payment breakdown */}
          <div className="px-6 py-4 border-b" style={{ borderColor: '#1e1e2e' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>Payment</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#9ca3af' }}>Deposit</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{peso(b.deposit_amount)}</span>
                  {b.deposit_paid
                    ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Paid ✓</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>Pending</span>}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: '#9ca3af' }}>Balance</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{peso(b.balance_amount)}</span>
                  {b.balance_paid
                    ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Paid ✓</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>On event day</span>}
                </div>
              </div>
              {outstanding > 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t" style={{ borderColor: '#1e1e2e' }}>
                  <span className="font-semibold" style={{ color: '#9ca3af' }}>Outstanding</span>
                  <span className="font-bold" style={{ color: '#f59e0b' }}>{peso(outstanding)}</span>
                </div>
              )}
              {outstanding <= 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t" style={{ borderColor: '#1e1e2e' }}>
                  <span className="font-semibold" style={{ color: '#9ca3af' }}>Status</span>
                  <span className="font-bold" style={{ color: '#34d399' }}>Fully Paid ✓</span>
                </div>
              )}
            </div>
          </div>

          {/* GCash payment info */}
          {!b.deposit_paid && (
            <div className="px-6 py-4 border-b" style={{ borderColor: '#1e1e2e', background: 'rgba(99,102,241,0.06)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>How to Pay Deposit</p>
              <p className="text-sm text-white font-medium mb-1">GCash</p>
              <p className="text-sm" style={{ color: '#9ca3af' }}>Send <strong className="text-white">{peso(b.deposit_amount)}</strong> to:</p>
              <p className="text-lg font-bold text-white mt-1">0917-XXX-XXXX</p>
              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Account name: James Ignacio</p>
              <p className="text-xs mt-3" style={{ color: '#6b7280' }}>
                Screenshot your GCash receipt and send it to us on Messenger so we can confirm your slot. 🙏
              </p>
            </div>
          )}

          {/* Terms */}
          <div className="px6 py-4 px-6">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#6b7280' }}>Terms</p>
            <ul className="space-y-1.5">
              {[
                'Deposit is non-refundable once confirmed.',
                'Rescheduling is allowed up to 7 days before the event (subject to availability).',
                'Balance is due on the day of the event before service begins.',
                'Craftifyle reserves the right to cancel if deposit is not paid within 48 hours of booking.',
              ].map((t, i) => (
                <li key={i} className="text-xs flex gap-2" style={{ color: '#6b7280' }}>
                  <span style={{ color: '#4a4a6a' }}>•</span> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-center" style={{ color: '#4a4a6a' }}>
          Questions? Message us on Facebook · Craftifyle Photobooth · Zamboanga City 🇵🇭
        </p>
      </div>
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090f' }}>
      <div className="text-center">
        <p className="text-4xl mb-4">🔗</p>
        <p className="text-white font-semibold mb-2">Link not valid</p>
        <p className="text-sm" style={{ color: '#6b7280' }}>{message}</p>
      </div>
    </div>
  )
}
