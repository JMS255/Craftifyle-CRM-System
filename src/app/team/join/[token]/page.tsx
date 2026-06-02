'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function TeamJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'done' | 'error'>('loading')
  const [ownerName, setOwnerName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()

      if (!user) {
        // Not logged in — redirect to signup with next param
        router.replace(`/signup?next=/team/join/${token}`)
        return
      }

      // Verify token exists and is pending
      const res = await fetch(`/api/team/join?token=${token}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Invalid invite link.'); setStatus('error'); return }

      setOwnerName(data.ownerName ?? 'your team owner')
      setStatus('ready')
    }
    init()
  }, [token, router])

  async function accept() {
    setStatus('joining')
    const res = await fetch('/api/team/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (data.ok) { setStatus('done') }
    else { setError(data.error ?? 'Failed to join.'); setStatus('error') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-4"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 32px rgba(99,102,241,0.3)' }}>
            C
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Team Invite</h1>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          {status === 'loading' && (
            <p className="text-sm text-center" style={{ color: 'var(--text-faint)' }}>Checking invite…</p>
          )}

          {status === 'ready' && (
            <div className="text-center space-y-4">
              <div className="text-3xl">🎉</div>
              <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>You&apos;ve been invited</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                <strong>{ownerName}</strong> has invited you to join their Crafty CRM team as a staff member.
              </p>
              <button onClick={accept}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                Accept Invite →
              </button>
            </div>
          )}

          {status === 'joining' && (
            <p className="text-sm text-center" style={{ color: 'var(--text-faint)' }}>Joining team…</p>
          )}

          {status === 'done' && (
            <div className="text-center space-y-4">
              <div className="text-3xl">✅</div>
              <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>You&apos;re in!</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>You now have access to the team&apos;s CRM.</p>
              <Link href="/"
                className="block w-full py-2.5 rounded-xl text-sm font-semibold text-white text-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                Go to Dashboard →
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-3">
              <div className="text-3xl">❌</div>
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
              <Link href="/" className="text-sm" style={{ color: 'var(--accent-text)' }}>Go to Dashboard</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
