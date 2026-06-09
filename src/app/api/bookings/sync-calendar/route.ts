import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar'

export async function POST(req: NextRequest) {
  const { bookingId, action } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'No bookingId' }, { status: 400 })

  const bookingDoc = await adminDb.collection('bookings').doc(bookingId).get()
  if (!bookingDoc.exists) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  const booking = { id: bookingDoc.id, ...bookingDoc.data() } as Record<string, unknown>

  let clientName = 'Client'
  let guestCount: number | null = null
  if (booking.lead_id) {
    const leadDoc = await adminDb.collection('leads').doc(booking.lead_id as string).get()
    if (leadDoc.exists) {
      const lead = leadDoc.data() as Record<string, unknown>
      clientName = (lead.name as string) ?? 'Client'
      guestCount = (lead.guest_count as number | null) ?? null
    }
  }
  const title = `📸 ${booking.event_name}`
  const description = [
    `Client: ${clientName}`,
    guestCount ? `Guests: ${guestCount} pax` : null,
    booking.package_name ? `Package: ${booking.package_name}` : null,
    booking.package_price ? `Price: ₱${booking.package_price.toLocaleString()}` : null,
    `Deposit: ${booking.deposit_paid ? '✅ Paid' : '❌ Pending'}`,
  ].filter(Boolean).join('\n')

  // Delete from calendar
  if (action === 'delete') {
    if (booking.gcal_event_id) {
      await deleteCalendarEvent(booking.gcal_event_id as string)
      await adminDb.collection('bookings').doc(bookingId).update({ gcal_event_id: null })
    }
    return NextResponse.json({ ok: true })
  }

  // Create new event
  if (!booking.gcal_event_id) {
    const eventId = await createCalendarEvent({
      title,
      date: booking.event_date as string,
      time: booking.event_time as string,
      venue: booking.venue as string,
      description,
    })
    if (eventId) {
      await adminDb.collection('bookings').doc(bookingId).update({ gcal_event_id: eventId })
    }
    return NextResponse.json({ ok: true, eventId })
  }

  // Update existing event
  await updateCalendarEvent({
    eventId: booking.gcal_event_id as string,
    title,
    date: booking.event_date as string,
    time: booking.event_time as string,
    venue: booking.venue as string,
    description,
    cancelled: booking.status === 'cancelled',
  })

  return NextResponse.json({ ok: true })
}
