import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase'

// GET — verify token and return owner info
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: invite } = await admin.from('team_invites')
    .select('id, owner_id, status').eq('token', token).maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invite not found or expired.' }, { status: 404 })
  if (invite.status === 'accepted') return NextResponse.json({ error: 'This invite has already been used.' }, { status: 400 })

  // Get owner's profile name
  const { data: profile } = await admin.from('profiles')
    .select('full_name, business_name').eq('id', invite.owner_id).maybeSingle()
  const ownerName = profile?.business_name || profile?.full_name || 'the team owner'

  return NextResponse.json({ ownerName })
}

// POST — accept invite
export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const db = createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const admin = createAdminClient()
  const { data: invite } = await admin.from('team_invites')
    .select('id, status').eq('token', token).maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invite not found or expired.' }, { status: 404 })
  if (invite.status === 'accepted') return NextResponse.json({ error: 'Already used.' }, { status: 400 })

  const { error } = await admin.from('team_invites').update({
    member_user_id: user.id,
    status: 'accepted',
  }).eq('id', invite.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
