'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

function SignupForm() {
  const router = useRouter()
  const [step, setStep] = useState<'code' | 'register'>('code')
  const [inviteCode, setInviteCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // On mount: if open beta (no INVITE_CODE set), skip invite step entirely
  useEffect(() => {
    fetch('/api/auth/check-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '' }),
    }).then(r => { if (r.ok) setStep('register') })
  }, [])

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
    if (!res.ok) {
      setError('Invalid invite code. Ask James for the correct one.')
      return
    }
    setStep('register')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const db = createClient()
    const { data, error: authError } = await db.auth.signUp({ email, password })
    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    // If email confirmation is disabled, session is returned immediately — redirect to app
    if (data.session) {
      router.replace('/')
      return
    }

    // Email confirmation required
    setDone(true)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 transition-colors"
      style={{ background: 'var(--bg)' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }}
        />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
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
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>
            Craftifyle CRM
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>
            {step === 'code' ? 'Enter your invite code to continue' : 'Create your free account'}
          </p>
        </div>

        {done ? (
          <div
            className="rounded-2xl p-6 text-center space-y-3"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            <div className="text-4xl">✅</div>
            <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>Account created!</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Check your email to confirm your account, then sign in.
            </p>
            <Link
              href="/login"
              className="block w-full py-2.5 rounded-xl text-sm font-semibold text-white text-center mt-2"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              Go to Sign In →
            </Link>
          </div>
        ) : (
          <div
            className="rounded-2xl p-6 transition-colors"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            {step === 'code' ? (
              <form onSubmit={checkCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Invite Code
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter code from James"
                    required
                    autoFocus
                    className="w-full rounded-xl px-4 py-2.5 text-sm tracking-wider"
                  />
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
                    This is a closed beta — you need an invite code to register.
                  </p>
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
                  {loading ? 'Checking…' : 'Continue →'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    autoComplete="email"
                    className="w-full rounded-xl px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    autoComplete="new-password"
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
                  {loading ? 'Creating account…' : 'Create Account →'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('code'); setError(null) }}
                  className="w-full text-xs py-1"
                  style={{ color: 'var(--text-faint)' }}
                >
                  ← Back
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-xs mt-4" style={{ color: 'var(--card-border)' }}>
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
