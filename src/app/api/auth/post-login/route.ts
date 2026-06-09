import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

const MIGRATABLE_COLLECTIONS = ['leads', 'bookings', 'packages', 'team_invites', 'messenger_conversations']

async function migrateUserData(oldUid: string, newUid: string, email: string) {
  // Move all collection documents from old UID to new UID
  for (const col of MIGRATABLE_COLLECTIONS) {
    const snap = await adminDb.collection(col).where('user_id', '==', oldUid).get()
    if (snap.empty) continue
    const batch = adminDb.batch()
    snap.docs.forEach(d => batch.update(d.ref, { user_id: newUid }))
    await batch.commit()
  }

  // Move profile doc: old UID → new UID, stamping in the email
  const oldProfile = await adminDb.collection('profiles').doc(oldUid).get()
  if (oldProfile.exists) {
    await adminDb.collection('profiles').doc(newUid).set({ ...oldProfile.data(), email })
    await adminDb.collection('profiles').doc(oldUid).delete()
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('__session')?.value
    if (!sessionCookie) return NextResponse.json({ ok: false }, { status: 401 })

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const uid = decoded.uid
    const email = decoded.email ?? ''

    // Already has a profile — nothing to do
    const existing = await adminDb.collection('profiles').doc(uid).get()
    if (existing.exists) {
      // Backfill email if missing
      if (email && !existing.data()?.email) {
        await adminDb.collection('profiles').doc(uid).update({ email })
      }
      return NextResponse.json({ ok: true, migrated: false })
    }

    // Search for an old profile matching this email
    if (email) {
      const matchSnap = await adminDb.collection('profiles').where('email', '==', email).limit(1).get()
      if (!matchSnap.empty) {
        const oldUid = matchSnap.docs[0].id
        await migrateUserData(oldUid, uid, email)
        return NextResponse.json({ ok: true, migrated: true })
      }
    }

    // No old profile found — new user, onboarding will create the profile
    return NextResponse.json({ ok: true, migrated: false })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
