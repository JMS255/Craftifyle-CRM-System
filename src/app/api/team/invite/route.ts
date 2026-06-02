import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const db = createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Check if already invited
  const { data: existing } = await admin.from('team_invites')
    .select('id, status').eq('owner_id', user.id).eq('member_email', email.trim()).maybeSingle()
  if (existing) return NextResponse.json({ error: 'This email has already been invited.' }, { status: 400 })

  const { data: invite, error } = await admin.from('team_invites').insert({
    owner_id: user.id,
    member_email: email.trim().toLowerCase(),
  }).select('token').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: invite.token })
}
