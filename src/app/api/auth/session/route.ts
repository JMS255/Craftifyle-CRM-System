import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

// POST /api/auth/session — exchange Firebase ID token for a session cookie
export async function POST(req: NextRequest) {
  const { idToken } = await req.json()
  if (!idToken) return NextResponse.json({ error: 'ID token required' }, { status: 400 })

  try {
    // Session cookie valid for 5 days
    const expiresIn = 60 * 60 * 24 * 5 * 1000
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })

    const res = NextResponse.json({ ok: true })
    res.cookies.set('__session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid ID token' }, { status: 401 })
  }
}

// DELETE /api/auth/session — sign out
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('__session', '', { maxAge: 0, path: '/' })
  return res
}
