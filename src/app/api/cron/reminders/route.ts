import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

async function sendMessage(recipientId: string, text: string) {
  const pageToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN
  if (!pageToken) return
  await fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'MESSAGE_TAG',
      tag: 'CONFIRMED_EVENT_UPDATE',
      access_token: pageToken,
    }),
  })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const db = createClient()
  const now = new Date()

  // Find upcoming bookings in the next 3 days
  const today = now.toISOString().slice(0, 10)
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: bookings } = await db
    .from('bookings')
    .select('id, event_name, event_date, event_time, venue, lead_id, deposit_paid, balance_amount')
    .eq('status', 'upcoming')
    .gte('event_date', today)
    .lte('event_date', in3Days)

  let sent = 0

  for (const booking of bookings ?? []) {
    if (!booking.lead_id) continue

    const { data: lead } = await db
      .from('leads')
      .select('name, messenger_sender_id')
      .eq('id', booking.lead_id)
      .single()

    if (!lead?.messenger_sender_id) continue

    const firstName = lead.name.split(' ')[0]
    const eventDate = new Date(booking.event_date).toLocaleDateString('en-PH', {
      weekday: 'long', month: 'long', day: 'numeric',
    })
    const daysAway = Math.ceil(
      (new Date(booking.event_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    let message = `Hi ${firstName}! 📸 Just a reminder — ang inyong event ay ${daysAway === 1 ? 'bukas na' : `sa ${daysAway} days na`} (${eventDate})`
    if (booking.event_time) message += ` at ${booking.event_time}`
    if (booking.venue) message += `, ${booking.venue}`
    message += '. See you there! 🎉'

    if (!booking.deposit_paid) {
      message += `\n\nPaalala lang po — hindi pa nakukumpirma ang booking ninyo. Para ma-secure, magpadala po ng ₱1,000 deposit sa GCash: 0993-632-4512 (James Ignacio) 😊`
    } else if (booking.balance_amount > 0) {
      message += ` \n\nBalance due po: ₱${booking.balance_amount.toLocaleString()} — pwede ma-settle on the day ng event 😊`
    }

    try {
      await sendMessage(lead.messenger_sender_id, message)
      sent++
    } catch (e) {
      console.error(`Reminder failed for booking ${booking.id}:`, e)
    }
  }

  return NextResponse.json({ ok: true, sent })
}
