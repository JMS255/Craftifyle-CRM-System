import { NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'

export async function POST() {
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

  // Get all fully-paid bookings and already-synced income entries in parallel
  const [bookingsSnap, incomeSnap] = await Promise.all([
    adminDb.collection('bookings')
      .where('user_id', '==', userId)
      .where('balance_paid', '==', true)
      .get(),
    adminDb.collection('personal_income')
      .where('user_id', '==', userId)
      .where('booking_id', '!=', null)
      .get(),
  ])

  const syncedBookingIds = new Set(
    incomeSnap.docs.map((d: QueryDocumentSnapshot) => (d.data() as { booking_id: string }).booking_id)
  )

  const now = new Date().toISOString()
  let created = 0

  await Promise.all(
    bookingsSnap.docs
      .filter((d: QueryDocumentSnapshot) => !syncedBookingIds.has(d.id))
      .map(async (d: QueryDocumentSnapshot) => {
        const b = d.data() as {
          event_name: string
          event_date: string
          package_price?: number
          deposit_amount: number
          balance_amount: number
          package_name?: string
          status: string
        }
        if (b.status === 'cancelled') return
        await adminDb.collection('personal_income').add({
          user_id: userId,
          description: b.event_name,
          amount: b.package_price ?? (b.deposit_amount + b.balance_amount),
          income_date: b.event_date,
          category: 'booking',
          notes: b.package_name ? `Package: ${b.package_name}` : null,
          booking_id: d.id,
          created_at: now,
        })
        created++
      })
  )

  return NextResponse.json({ created })
}
