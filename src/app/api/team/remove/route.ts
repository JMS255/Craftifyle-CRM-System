import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { inviteId } = await req.json()
  if (!inviteId) return NextResponse.json({ error: 'Invite ID required' }, { status: 400 })

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value
  if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let userId: string
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    userId = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const doc = await adminDb.collection('team_invites').doc(inviteId).get()
  if (!doc.exists || doc.data()?.owner_id !== userId) {
    return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 })
  }
  await doc.ref.delete()
  return NextResponse.json({ ok: true })
}
