import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/api/auth/check-invite') ||
    pathname.startsWith('/api/auth/session') ||
    pathname.startsWith('/api/messenger') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/contract') ||
    pathname.startsWith('/api/paymongo/webhook') ||
    pathname.startsWith('/contract/') ||
    pathname.startsWith('/confirm/') ||
    pathname.startsWith('/team/join/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')

  if (isPublic) return NextResponse.next()

  const session = request.cookies.get('__session')?.value
  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Verify session cookie server-side via our own API
  // We use a lightweight check: just verify the cookie exists and is not empty
  // Full verification happens in individual API routes via adminAuth.verifySessionCookie()
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
