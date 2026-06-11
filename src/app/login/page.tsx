'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

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
    <div
      className="min-h-screen flex items-center justify-center p-4 transition-colors"
      style={{ background: 'var(--bg)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
        />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-4"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 0 32px rgba(99,102,241,0.3)',
            }}
          >
            C
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Crafty CRM</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Sign in to your dashboard</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4 transition-colors"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          <div>
            <button type="button" onClick={handleGoogleLogin} disabled={googleLoading}
              className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-3 disabled:opacity-60 hover:opacity-90 transition-all"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}>
              {googleLoading ? <span style={{ color: 'var(--text-muted)' }}>Connecting…</span> : <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full rounded-xl px-4 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full rounded-xl px-4 py-2.5 text-sm"
            />
          </div>

          {error && (
            <div
              className="text-xs rounded-xl px-4 py-2.5"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <div className="mt-4 rounded-2xl p-4 text-center transition-colors"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Just browsing? Try the demo
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-faint)' }}>
            See a real account with sample data — no sign up needed.
          </p>
          <button
            type="button"
            onClick={() => {
              setEmail('demo@craftycrmm.vercel.app')
              setPassword('craftydemo2026')
            }}
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--accent-glow)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
            Fill demo credentials →
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
