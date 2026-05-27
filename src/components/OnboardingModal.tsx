'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const STEPS = [
  {
    icon: '◎',
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.15)',
    title: 'Leads',
    description:
      'Every inquiry is a lead. Add them manually or let Crafty AI capture them from Messenger automatically. Move them through your pipeline: New → Contacted → Quoted → Booked.',
    tip: '💡 Tip: Use "+ New Lead" on the dashboard to add your first one.',
  },
  {
    icon: '◈',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    title: 'Bookings',
    description:
      'When a lead says yes, convert them to a Booking. Track the event date, venue, package price, deposit, and balance. You can also generate a printable invoice from here.',
    tip: '💡 Tip: Open a lead and click "Convert to Booking" when they confirm.',
  },
  {
    icon: '◇',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    title: 'Finances',
    description:
      'Track your personal income and expenses month by month. See your net profit, best months, and spending breakdown — all separate from your booking income.',
    tip: '💡 Tip: Log an income or expense entry after every transaction.',
  },
  {
    icon: '◉',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.15)',
    title: 'Ad Performance',
    description:
      'Run a Facebook ad? Tag the link with a ref code (like m.me/yourpage?ref=ad_name) and Crafty will automatically track which ad brought in which leads and bookings.',
    tip: '💡 Tip: Use Traffic objective ads (not Chat Builder) for tracking to work.',
  },
]

export default function OnboardingModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const db = createClient()
    db.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      setUserId(uid)
      const seen = localStorage.getItem(`crafty-onboarded-${uid}`)
      if (!seen) setOpen(true)
    })
  }, [])

  function dismiss() {
    if (userId) localStorage.setItem(`crafty-onboarded-${userId}`, '1')
    setOpen(false)
    setStep(0)
  }

  function reopen() {
    setStep(0)
    setOpen(true)
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <>
      {/* Help button — always visible in corner */}
      <button
        onClick={reopen}
        title="How to use Crafty CRM"
        className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-40 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all hover:scale-110"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white',
          boxShadow: '0 0 16px rgba(99,102,241,0.4)',
        }}
      >
        ?
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => e.target === e.currentTarget && dismiss()}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            {/* Header */}
            <div
              className="px-6 pt-6 pb-4"
              style={{ borderBottom: '1px solid var(--card-border)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    C
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
                    Crafty CRM — Getting Started
                  </span>
                </div>
                <button
                  onClick={dismiss}
                  className="text-lg leading-none transition-opacity hover:opacity-60"
                  style={{ color: 'var(--text-faint)' }}
                >
                  ×
                </button>
              </div>
              <h2 className="text-lg font-bold mt-3" style={{ color: 'var(--text-heading)' }}>
                Welcome to Crafty CRM 👋
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Here&apos;s a quick look at how everything works.
              </p>

              {/* Step dots */}
              <div className="flex gap-1.5 mt-4">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === step ? '24px' : '6px',
                      background: i === step ? current.color : 'var(--card-border)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Step content */}
            <div className="px-6 py-5">
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                style={{ background: current.glow }}
              >
                <span style={{ color: current.color }}>{current.icon}</span>
              </div>

              <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-heading)' }}>
                {current.title}
              </h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
                {current.description}
              </p>

              {/* Tip */}
              <div
                className="rounded-xl px-4 py-3 text-xs"
                style={{
                  background: current.glow,
                  color: current.color,
                  border: `1px solid ${current.glow}`,
                }}
              >
                {current.tip}
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-6 pb-6 flex items-center justify-between gap-3"
            >
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="text-sm px-4 py-2 rounded-xl transition-all disabled:opacity-0"
                style={{
                  background: 'var(--subtle-bg)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--card-border)',
                }}
              >
                ← Back
              </button>

              <div className="flex gap-2 ml-auto">
                {!isLast ? (
                  <button
                    onClick={() => setStep((s) => s + 1)}
                    className="text-sm px-5 py-2 rounded-xl font-medium text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    Next →
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <Link
                      href="/leads/new"
                      onClick={dismiss}
                      className="text-sm px-4 py-2 rounded-xl font-medium transition-all"
                      style={{
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent-text)',
                        border: '1px solid var(--accent)',
                      }}
                    >
                      Add First Lead
                    </Link>
                    <button
                      onClick={dismiss}
                      className="text-sm px-5 py-2 rounded-xl font-medium text-white transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    >
                      Let&apos;s go! 🚀
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
