import { adminDb } from '@/lib/firebase-admin'
import type { Booking } from '@/types'
import ContractSign from './ContractSign'

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

const TERMS = [
  ['1. Deposit & Payment', 'The deposit secures your date exclusively and is non-refundable once booking is confirmed. The remaining balance is due on or before the event date, prior to the start of service. Failure to settle the balance may result in cancellation without refund of the deposit.'],
  ['2. Cancellation', 'If the client cancels the booking, the deposit is forfeited. If Craftifyle Photobooth must cancel due to circumstances within our control, a full refund of all payments will be issued.'],
  ['3. Rescheduling', 'Rescheduling requests must be made at least 7 days before the event and are subject to availability. Only one reschedule is allowed per booking at no extra charge.'],
  ['4. Equipment & Liability', 'Craftifyle Photobooth will provide all necessary equipment. The client is responsible for ensuring reasonable care of all equipment during the event. Damage caused by guests will be charged accordingly.'],
  ['5. Force Majeure', 'Neither party shall be held liable for failure to perform due to circumstances beyond reasonable control, including natural disasters, government-imposed restrictions, or declared public emergencies.'],
  ['6. Media Rights', 'Craftifyle Photobooth reserves the right to use photos and videos taken during the event for portfolio and promotional purposes. Clients wishing to opt out must notify us in writing before the event date.'],
]

export default async function ContractPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let bookingId: string
  try {
    bookingId = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  } catch {
    return <ErrorPage message="Invalid contract link." />
  }

  const bookingDoc = await adminDb.collection('bookings').doc(bookingId).get()
  if (!bookingDoc.exists) return <ErrorPage message="Booking not found. Please contact Craftifyle." />
  const b = { id: bookingDoc.id, ...bookingDoc.data() } as Booking

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-12"
      style={{ background: '#09090f', fontFamily: 'system-ui, sans-serif' }}>
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            📄
          </div>
          <h1 className="text-xl font-bold text-white">Craftifyle Photobooth</h1>
          <p style={{ color: '#6b7280', fontSize: 13 }}>Service Agreement</p>
        </div>

        {/* Booking details */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
          <div className="px-6 py-5 border-b" style={{ borderColor: '#1e1e2e' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#6366f1' }}>Booking</p>
            <h2 className="text-xl font-bold text-white">{b.event_name}</h2>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>{fmt(b.event_date)}</p>
            {b.event_time && <p className="text-sm" style={{ color: '#9ca3af' }}>{b.event_time}</p>}
            {b.venue && <p className="text-sm mt-1" style={{ color: '#6b7280' }}>📍 {b.venue}</p>}
            {b.package_name && <p className="text-sm mt-1" style={{ color: '#6b7280' }}>📦 {b.package_name}</p>}
          </div>

          {/* Terms */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#6b7280' }}>Terms & Conditions</p>
            <div className="space-y-5">
              {TERMS.map(([title, body]) => (
                <div key={title}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: '#e2e2f0' }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sign */}
        <ContractSign
          bookingId={bookingId}
          signedAt={b.contract_signed_at ?? null}
          signedName={b.contract_signed_name ?? null}
        />

        <p className="text-xs text-center mt-6" style={{ color: '#4a4a6a' }}>
          Craftifyle Photobooth · Zamboanga City 🇵🇭 · jamesignacio255@gmail.com
        </p>
      </div>
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090f' }}>
      <div className="text-center">
        <p className="text-4xl mb-4">📄</p>
        <p className="text-white font-semibold mb-2">Link not valid</p>
        <p className="text-sm" style={{ color: '#6b7280' }}>{message}</p>
      </div>
    </div>
  )
}
