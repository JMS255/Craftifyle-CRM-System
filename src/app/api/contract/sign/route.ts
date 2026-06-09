import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  const { bookingId, name } = await req.json()
  if (!bookingId || !name?.trim())
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  await adminDb.collection('bookings').doc(bookingId).update({
    contract_signed_at: new Date().toISOString(),
    contract_signed_name: name.trim(),
  })

  return NextResponse.json({ ok: true })
}
