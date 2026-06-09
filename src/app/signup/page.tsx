'use client'

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth'
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

function SignupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setGoogleLoading(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      await createSession(result.user)
      window.location.href = '/'
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('operation-not-allowed')) {
        setError('Google sign-in is not yet enabled. Use email/password for now.')
      } else {
        setError('Google sign-in failed. Please try again.')
      }
    }
    setGoogleLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      if (name.trim()) await updateProfile(result.user, { displayName: name.trim() })
      await createSession(result.user)
      router.replace('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('email-already-in-use')) {
        setError('An account with this email already exists. Sign in instead.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create account.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 32px rgba(99,102,241,0.3)' }}>
            C
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Craftifyle CRM</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Create your free account</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          {/* Google */}
          <button type="button" onClick={handleGoogle} disabled={googleLoading}
            className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-3 mb-4 transition-all disabled:opacity-60 hover:opacity-90"
            style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}>
            {googleLoading
              ? <span style={{ color: 'var(--text-muted)' }}>Connecting…</span>
              : <>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
            }
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>or sign up with email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
          </div>

          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Full name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Juan dela Cruz" autoComplete="name" autoFocus
                className="w-full rounded-xl px-4 py-3 text-sm" style={{ fontSize: '16px' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="email"
                className="w-full rounded-xl px-4 py-3 text-sm" inputMode="email" style={{ fontSize: '16px' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required autoComplete="new-password"
                  className="w-full rounded-xl px-4 py-3 text-sm pr-12" style={{ fontSize: '16px' }} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--text-faint)' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs rounded-xl px-4 py-2.5"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '14px' }}>
              {loading ? 'Creating account…' : 'Create Free Account'}
            </button>

            <p className="text-center text-xs pt-1" style={{ color: 'var(--text-faint)' }}>
              Ligtas ang iyong datos. 🔒
            </p>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent-text)' }} className="hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
