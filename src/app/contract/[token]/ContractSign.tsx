'use client'

import { useState } from 'react'

export default function ContractSign({ bookingId, signedAt, signedName }: {
  bookingId: string
  signedAt: string | null
  signedName: string | null
}) {
  const [name, setName] = useState('')
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(!!signedAt)
  const [finalName, setFinalName] = useState(signedName ?? '')
  const [finalDate, setFinalDate] = useState(
    signedAt ? new Date(signedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : ''
  )
  const [error, setError] = useState('')

  async function sign() {
    if (!name.trim()) return
    setSigning(true)
    setError('')
    const res = await fetch('/api/contract/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, name: name.trim() }),
    })
    const data = await res.json()
    if (data.ok) {
      setSigned(true)
      setFinalName(name.trim())
      setFinalDate(new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }))
    } else {
      setError(data.error ?? 'Something went wrong — try again.')
    }
    setSigning(false)
  }

  if (signed) {
    return (
      <div className="rounded-2xl p-6 text-center"
        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
        <div className="text-3xl mb-3">✅</div>
        <p className="font-semibold text-white mb-1">Agreement Signed</p>
        <p className="text-sm" style={{ color: '#34d399' }}>Signed by {finalName}</p>
        <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{finalDate}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
      <p className="text-sm font-semibold text-white mb-1">Sign this agreement</p>
      <p className="text-xs mb-4" style={{ color: '#6b7280' }}>
        By typing your full name and clicking &quot;I Agree&quot;, you confirm that you have read and accept all the terms above.
      </p>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Type your full name exactly"
        className="w-full rounded-xl px-4 py-3 text-sm mb-3"
        style={{ background: '#0f0f17', border: '1px solid #2a2a3a', color: '#f4f4f6' }}
      />
      {error && <p className="text-xs mb-3" style={{ color: '#f87171' }}>{error}</p>}
      <button
        onClick={sign}
        disabled={!name.trim() || signing}
        className="w-full py-3 rounded-[10px] text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        {signing ? 'Signing…' : '✍️ I Agree & Sign'}
      </button>
    </div>
  )
}
