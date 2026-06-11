'use client'

import type { ProjectionMonth } from './SurvivalProjectionCard'

export default function FinanceStatusBanner({ months }: { months: ProjectionMonth[] }) {
  if (!months.length) return null

  const danger = months.find(m => m.endCash < 0)
  const tight  = months.find(m => m.endCash >= 0 && m.endCash < 10000)

  let bg      = 'rgba(16,185,129,0.1)'
  let border  = 'rgba(16,185,129,0.2)'
  let color   = '#10b981'
  let message = `✅ You're on track. ${months[0].label} projected end: ₱${Math.round(months[0].endCash).toLocaleString('en-PH')}.`

  if (danger) {
    bg      = 'rgba(239,68,68,0.1)'
    border  = 'rgba(239,68,68,0.2)'
    color   = '#ef4444'
    const gap = Math.abs(Math.round(danger.endCash))
    message = `⚠️ ${danger.label} is a danger month — ₱${gap.toLocaleString('en-PH')} shortfall projected. You need one more booking.`
  } else if (tight) {
    bg      = 'rgba(245,158,11,0.1)'
    border  = 'rgba(245,158,11,0.2)'
    color   = '#f59e0b'
    message = `🟡 ${tight.label} is tight — only ₱${Math.round(tight.endCash).toLocaleString('en-PH')} projected. Watch your spending.`
  }

  return (
    <div
      className="rounded-xl px-4 py-3 mb-3 text-sm font-medium leading-snug"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      {message}
    </div>
  )
}
