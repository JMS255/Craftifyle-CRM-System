'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import ShaderBackground from '@/components/ShaderBackground'

async function createSession(user: { getIdToken: () => Promise<string> }) {
  const idToken = await user.getIdToken()
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  await fetch('/api/auth/post-login', { method: 'POST' })
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) router.replace(next)
    })
    return unsub
  }, [next, router])

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      await createSession(result.user)
      window.location.href = next
    } catch {
      setError('Google sign-in failed. Please try again.')
    }
    setGoogleLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      await createSession(result.user)
      window.location.href = next
    } catch {
      setError('Incorrect email or password.')
    }
    setLoading(false)
  }

  return (
    <>
      <ShaderBackground />

      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              display: 'inline-flex', width: '56px', height: '56px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #6357e8, #a78bfa)',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '26px', fontWeight: 800, color: '#fff',
              boxShadow: '0 0 40px rgba(99,87,232,0.55), 0 0 80px rgba(124,111,247,0.22)',
              marginBottom: '10px',
            }}>C</div>
            <div style={{ fontSize: '21px', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
              Craftifyle
            </div>
            <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.42)', marginTop: '2px' }}>
              Business CRM
            </div>
          </div>

          {/* Glass card */}
          <div style={{
            background: 'rgba(8,6,28,0.72)',
            backdropFilter: 'blur(22px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '18px',
            padding: '28px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.35), 0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '19px', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
                Welcome back
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', marginTop: '3px' }}>
                Sign in to your dashboard
              </div>
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              style={{
                width: '100%', padding: '11px 16px', borderRadius: '9px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.14)',
                color: '#fff', fontSize: '13.5px', fontWeight: 500, transition: 'all 0.15s',
                opacity: googleLoading ? 0.6 : 1,
              }}
            >
              {googleLoading ? 'Connecting…' : <>
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.09)' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.26)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.09)' }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.38)', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '14px',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)',
                    color: '#fff', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.38)', marginBottom: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '14px',
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)',
                    color: '#fff', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div style={{
                  fontSize: '12px', borderRadius: '8px', padding: '10px 14px',
                  background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '12px', borderRadius: '9px', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6357e8, #8b5cf6 50%, #a78bfa)',
                  color: '#fff', fontSize: '14px', fontWeight: 700, border: 'none',
                  boxShadow: '0 4px 20px rgba(99,87,232,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                  opacity: loading ? 0.6 : 1, marginTop: '2px',
                }}
              >
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
            </form>
          </div>

          {/* Demo card */}
          <div style={{
            marginTop: '12px',
            background: 'rgba(8,6,28,0.60)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '14px',
            padding: '16px 20px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
              Just browsing? Try the demo
            </p>
            <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.28)', marginBottom: '12px' }}>
              See a real account with sample data — no sign up needed.
            </p>
            <button
              type="button"
              onClick={() => { setEmail('demo@craftycrmm.vercel.app'); setPassword('craftydemo2026') }}
              style={{
                width: '100%', padding: '9px', borderRadius: '8px', cursor: 'pointer',
                background: 'rgba(124,111,247,0.18)', border: '1px solid rgba(124,111,247,0.3)',
                color: '#c4b5fd', fontSize: '12.5px', fontWeight: 600,
              }}
            >
              Fill demo credentials →
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '12.5px', color: 'rgba(255,255,255,0.28)' }}>
            No account?{' '}
            <a href="/signup" style={{ color: '#c4b5fd', textDecoration: 'none' }}>
              Sign up free
            </a>
          </p>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
