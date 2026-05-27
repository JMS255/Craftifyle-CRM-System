import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar'

export async function POST(req: NextRequest) {
  const { bookingId, action } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'No bookingId' }, { status: 400 })

  const db = createClient()
  const { data: booking } = await db
    .from('bookings')
    .select('*, leads(name, guest_count)')
    .eq('id', bookingId)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const clientName = (booking.leads as { name: string } | null)?.name ?? 'Client'
  const guestCount = (booking.leads as { guest_count: number | null } | null)?.guest_count
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
      await deleteCalendarEvent(booking.gcal_event_id)
      await db.from('bookings').update({ gcal_event_id: null }).eq('id', bookingId)
    }
    return NextResponse.json({ ok: true })
  }

  // Create new event
  if (!booking.gcal_event_id) {
    const eventId = await createCalendarEvent({
      title,
      date: booking.event_date,
      time: booking.event_time,
      venue: booking.venue,
      description,
    })
    if (eventId) {
      await db.from('bookings').update({ gcal_event_id: eventId }).eq('id', bookingId)
    }
    return NextResponse.json({ ok: true, eventId })
  }

  // Update existing event
  await updateCalendarEvent({
    eventId: booking.gcal_event_id,
    title,
    date: booking.event_date,
    time: booking.event_time,
    venue: booking.venue,
    description,
    cancelled: booking.status === 'cancelled',
  })

  return NextResponse.json({ ok: true })
}
