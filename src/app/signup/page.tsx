'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createUserWithEmailAndPassword, FacebookAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/lib/firebase'

async function createSession(user: { getIdToken: () => Promise<string> }) {
  const idToken = await user.getIdToken()
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
}

function SignupForm() {
  const router = useRouter()
  const [step, setStep] = useState<'code' | 'register'>('code')
  const [inviteCode, setInviteCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fbLoading, setFbLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/check-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '' }),
    }).then(r => { if (r.ok) setStep('register') })
  }, [])

  async function handleFacebookSignup() {
    setFbLoading(true)
    setError(null)
    try {
      const provider = new FacebookAuthProvider()
      const result = await signInWithPopup(auth, provider)
      await createSession(result.user)
      window.location.href = '/'
    } catch {
      setError('Facebook login failed. Make sure it is enabled in Firebase.')
    }
    setFbLoading(false)
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await fetch('/api/auth/check-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCode.trim() }),
    })
    setLoading(false)
    if (!res.ok) { setError('Invalid invite code. Ask James for the correct one.'); return }
    setStep('register')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      await createSession(result.user)
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.')
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
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }}
        />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 32px rgba(99,102,241,0.3)' }}
          >C</div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Craftifyle CRM</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
            {step === 'code' ? 'Enter your invite code to continue' : 'Create your free account'}
          </p>
        </div>

        <div className="rounded-2xl p-6 transition-colors" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          {step === 'code' ? (
            <>
              <div className="space-y-3 mb-4">
                <button type="button" onClick={handleFacebookSignup} disabled={fbLoading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#1877F2', color: '#fff' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  {fbLoading ? 'Connecting…' : 'Continue with Facebook'}
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>or use invite code</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                </div>
              </div>
              <form onSubmit={checkCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Invite Code</label>
                  <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                    placeholder="Enter code from James" required autoFocus
                    className="w-full rounded-xl px-4 py-2.5 text-sm tracking-wider" />
                </div>
                {error && <div className="text-xs rounded-xl px-4 py-2.5" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  {loading ? 'Checking…' : 'Continue →'}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoFocus autoComplete="email"
                  className="w-full rounded-xl px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required autoComplete="new-password"
                  className="w-full rounded-xl px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password" required autoComplete="new-password"
                  className="w-full rounded-xl px-4 py-2.5 text-sm" />
              </div>
              {error && <div className="text-xs rounded-xl px-4 py-2.5" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {loading ? 'Creating account…' : 'Create Account →'}
              </button>
              <button type="button" onClick={() => { setStep('code'); setError(null) }}
                className="w-full text-xs py-1" style={{ color: 'var(--text-faint)' }}>
                ← Back
              </button>
            </form>
          )}
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
