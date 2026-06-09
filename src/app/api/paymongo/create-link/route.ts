import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

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

    await adminDb.collection('bookings').doc(bookingId).update({ paymongo_link_id: linkId, paymongo_link_url: linkUrl })

    return NextResponse.json({ linkId, linkUrl })
  } catch {
    return NextResponse.json({ error: 'Network error — check your PayMongo API key.' }, { status: 500 })
  }
}
