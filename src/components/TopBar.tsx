'use client'

import { ReactNode } from 'react'

interface Props {
  page: string
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function TopBar({ page, title, subtitle, actions }: Props) {
  const today = new Date().toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between print:hidden"
      style={{
        background: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--sidebar-border)',
      }}
    >
      <div>
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Craftifyle&nbsp;
          <span style={{ color: 'var(--text-faint)' }}>/</span>
          &nbsp;{page}
        </p>
        <h1 className="text-lg font-bold leading-tight mt-0.5" style={{ color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs mr-1 hidden sm:block" style={{ color: 'var(--text-faint)' }}>{today}</span>
        {actions}
      </div>
    </div>
  )
}