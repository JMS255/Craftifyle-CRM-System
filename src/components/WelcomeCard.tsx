'use client'

import { useEffect, useState } from 'react'

interface Props {
  storageKey: string
  icon: string
  title: string
  description: string
  tips: string[]
  accentColor?: string
}

export default function WelcomeCard({
  storageKey, icon, title, description, tips, accentColor = '#6366f1',
}: Props) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) setVisible(true)
  }, [storageKey])

  function dismiss() {
    setLeaving(true)
    setTimeout(() => {
      localStorage.setItem(storageKey, '1')
      setVisible(false)
    }, 400)
  }

  if (!visible) return null

  return (
    <div style={{
      overflow: 'hidden',
      maxHeight: leaving ? 0 : '600px',
      marginBottom: leaving ? 0 : '1.5rem',
      transition: 'max-height 0.4s ease, margin-bottom 0.4s ease',
    }}>
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${accentColor}33`,
        background: `${accentColor}0d`,
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'translateY(-4px) scale(0.99)' : 'translateY(0) scale(1)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: `${accentColor}22` }}
            >
              {icon}
            </span>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>{title}</p>
              <p className="text-xs mt-0.5 max-w-lg" style={{ color: 'var(--text-muted)' }}>{description}</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium mt-0.5 transition-opacity hover:opacity-70"
            style={{ background: `${accentColor}22`, color: accentColor }}
          >
            Got it
          </button>
        </div>

        <div
          className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-2"
          style={{ borderTop: `1px solid ${accentColor}22` }}
        >
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color: accentColor }}>
                {i + 1}
              </span>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  )
}
