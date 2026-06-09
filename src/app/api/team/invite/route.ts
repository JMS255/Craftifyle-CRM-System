import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
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

  const { email } = await req.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const snap = await adminDb.collection('team_invites')
    .where('owner_id', '==', userId)
    .where('member_email', '==', email.trim().toLowerCase())
    .limit(1)
    .get()
  if (!snap.empty) return NextResponse.json({ error: 'This email has already been invited.' }, { status: 400 })

  const token = crypto.randomUUID()
  await adminDb.collection('team_invites').add({
    owner_id: userId,
    member_email: email.trim().toLowerCase(),
    token,
    status: 'pending',
    created_at: new Date().toISOString(),
  })

  return NextResponse.json({ token })
}
