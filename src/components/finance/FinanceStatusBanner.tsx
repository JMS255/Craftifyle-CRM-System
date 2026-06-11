'use client'

import type { ProjectionMonth } from './SurvivalProjectionCard'

export default function FinanceStatusBanner({ months }: { months: ProjectionMonth[] }) {
  if (!months.length) return null

  const currentCash = months[0].openingCash
  const dailyOutflow = (months[0].debt + months[0].expenses) / 30
  const daysRunway = dailyOutflow > 0 ? Math.max(0, Math.floor(currentCash / dailyOutflow)) : null

  const danger = months.find(m => m.endCash < 0)
  const tight  = months.find(m => m.endCash >= 0 && m.endCash < 10000)

  let color  = '#10b981'
  let bg     = 'rgba(16,185,129,0.1)'
  let border = 'rgba(16,185,129,0.2)'
  let badge  = '🟢 On Track'
  let message = `You're on track. ${months[0].label} projected end: ₱${Math.round(months[0].endCash).toLocaleString('en-PH')}.`

  if (danger) {
    color  = '#ef4444'
    bg     = 'rgba(239,68,68,0.1)'
    border = 'rgba(239,68,68,0.2)'
    badge  = '🔴 Danger'
    const gap = Math.abs(Math.round(danger.endCash))
    message = `${danger.label} is a danger month — ₱${gap.toLocaleString('en-PH')} shortfall projected. You need one more booking.`
  } else if (tight) {
    color  = '#f59e0b'
    bg     = 'rgba(245,158,11,0.1)'
    border = 'rgba(245,158,11,0.2)'
    badge  = '🟡 Tight'
    message = `${tight.label} is tight — only ₱${Math.round(tight.endCash).toLocaleString('en-PH')} projected. Watch your spending.`
  }

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: bg, border: `1px solid ${border}` }}>
      {/* Hero row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color, opacity: 0.75 }}>Current Cash</p>
          <p className="text-3xl font-bold tabular leading-none" style={{ color }}>
            ₱{Math.round(currentCash).toLocaleString('en-PH')}
          </p>
          {daysRunway !== null && (
            <p className="text-xs mt-1.5 font-medium" style={{ color, opacity: 0.7 }}>
              ~{daysRunway} days without new income
            </p>
          )}
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-2 mt-0.5"
          style={{ background: color + '28', color }}>
          {badge}
        </span>
      </div>
      {/* Insight */}
      <p className="text-xs leading-snug pt-2.5" style={{ color, opacity: 0.8, borderTop: `1px solid ${border}` }}>
        {message}
      </p>
    </div>
  )
}
