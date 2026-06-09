import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const snap = await adminDb.collection('team_invites').where('token', '==', token).limit(1).get()
  if (snap.empty) return NextResponse.json({ error: 'Invite not found or expired.' }, { status: 404 })

  const invite = snap.docs[0].data()
  if (invite.status === 'accepted') return NextResponse.json({ error: 'This invite has already been used.' }, { status: 400 })

  const profilesSnap = await adminDb.collection('profiles').doc(invite.owner_id).get()
  const profile = profilesSnap.data() as Record<string, string | null> | undefined
  const ownerName = profile?.business_name || profile?.full_name || 'the team owner'

  return NextResponse.json({ ownerName })
}

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value
  if (!sessionCookie) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let userId: string
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    userId = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const snap = await adminDb.collection('team_invites').where('token', '==', token).limit(1).get()
  if (snap.empty) return NextResponse.json({ error: 'Invite not found or expired.' }, { status: 404 })

  const doc = snap.docs[0]
  if (doc.data().status === 'accepted') return NextResponse.json({ error: 'Already used.' }, { status: 400 })

  await doc.ref.update({ member_user_id: userId, status: 'accepted' })
  return NextResponse.json({ ok: true })
}
