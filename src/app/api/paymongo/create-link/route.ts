import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { bookingId, amount, description } = await req.json()

  const secretKey = process.env.PAYMONGO_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'PayMongo not configured — add PAYMONGO_SECRET_KEY to Vercel env vars.' }, { status: 500 })

  const auth = Buffer.from(`${secretKey}:`).toString('base64')

  try {
    const res = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(amount * 100), // centavos
            description,
            remarks: `booking_id:${bookingId}`,
          },
        },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data.errors?.[0]?.detail ?? 'PayMongo error' },
        { status: 400 }
      )
    }

    const linkId: string = data.data.id
    const linkUrl: string = data.data.attributes.checkout_url

    // Persist on booking so it survives page refreshes
    const db = createAdminClient()
    await db.from('bookings')
      .update({ paymongo_link_id: linkId, paymongo_link_url: linkUrl })
      .eq('id', bookingId)

    return NextResponse.json({ linkId, linkUrl })
  } catch {
    return NextResponse.json({ error: 'Network error — check your PayMongo API key.' }, { status: 500 })
  }
}
