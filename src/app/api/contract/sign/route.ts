import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { bookingId, name } = await req.json()
  if (!bookingId || !name?.trim())
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.from('bookings').update({
    contract_signed_at: new Date().toISOString(),
    contract_signed_name: name.trim(),
  }).eq('id', bookingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
