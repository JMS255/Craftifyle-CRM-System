'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fbLoading, setFbLoading] = useState(false)

  async function handleFacebookLogin() {
    setFbLoading(true)
    setError(null)
    const db = createClient()
    const { error: fbError } = await db.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (fbError) setError('Facebook login not configured yet.')
    setFbLoading(false)
  }

  useEffect(() => {
    const db = createClient()
    db.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(next)
    })
  }, [next, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const db = createClient()
    const { error: authError } = await db.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Incorrect email or password.')
      setLoading(false)
      return
    }

    window.location.href = next
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
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
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
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Crafty CRM</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Sign in to your dashboard</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4 transition-colors"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          {/* Facebook Login */}
          <div>
            <button type="button" onClick={handleFacebookLogin} disabled={fbLoading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: '#1877F2', color: '#fff' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              {fbLoading ? 'Connecting…' : 'Continue with Facebook'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>or sign in with email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
          </div>

          {/* Email */}
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
              autoComplete="email"
              className="w-full rounded-xl px-4 py-2.5 text-sm"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Password
            </label>
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

          {/* Error */}
          {error && (
            <div
              className="text-xs rounded-xl px-4 py-2.5"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        {/* Demo account */}
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

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          New user?{' '}
          <Link href="/signup" style={{ color: 'var(--accent-text)' }} className="hover:underline">
            Sign up with invite code
          </Link>
        </p>
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
