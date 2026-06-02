import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.text()

  // Verify PayMongo signature if webhook secret is configured
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET
  if (webhookSecret) {
    const sig = req.headers.get('paymongo-signature') ?? ''
    const parts = Object.fromEntries(sig.split(',').map(p => {
      const [k, ...v] = p.split('=')
      return [k, v.join('=')]
    }))
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${parts.t}.${body}`)
      .digest('hex')
    if (expected !== parts.te) {
      return new NextResponse('Invalid signature', { status: 401 })
    }
  }

  const event = JSON.parse(body)
  const eventType: string = event.data?.attributes?.type ?? ''

  if (eventType === 'link.payment.paid') {
    const remarks: string = event.data?.attributes?.data?.attributes?.remarks ?? ''
    const bookingId = remarks.replace('booking_id:', '').trim()

    if (bookingId) {
      const db = createAdminClient()
      const today = new Date().toISOString().slice(0, 10)
      // Mark deposit paid if not already; if deposit already paid, mark balance paid
      const { data: booking } = await db
        .from('bookings')
        .select('deposit_paid, balance_paid')
        .eq('id', bookingId)
        .single()

      if (booking && !booking.deposit_paid) {
        await db.from('bookings')
          .update({ deposit_paid: true, deposit_paid_date: today })
          .eq('id', bookingId)
      } else if (booking && booking.deposit_paid && !booking.balance_paid) {
        await db.from('bookings')
          .update({ balance_paid: true, balance_paid_date: today })
          .eq('id', bookingId)
      }
    }
  }

  return NextResponse.json({ received: true })
}
