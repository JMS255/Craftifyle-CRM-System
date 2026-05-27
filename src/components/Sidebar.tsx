'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: 'Dashboard', short: 'Home', icon: '⊞' },
  { href: '/leads', label: 'Leads', short: 'Leads', icon: '◎' },
  { href: '/bookings', label: 'Bookings', short: 'Events', icon: '◈' },
  { href: '/ads', label: 'Ad Performance', short: 'Ads', icon: '◉' },
  { href: '/personal', label: 'Finances', short: 'Money', icon: '◇' },
]

export default function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col shrink-0 w-56 min-h-screen border-r"
        style={{ background: '#07070d', borderColor: '#141420' }}>

        {/* Logo */}
        <div className="px-5 py-6 border-b" style={{ borderColor: '#141420' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              C
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Craftifyle</p>
              <p className="text-xs leading-tight" style={{ color: '#4a4a6a' }}>CRM</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ href, label, icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: active ? '#a5b4fc' : '#6b7280',
                  borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
                }}
              >
                <span className="text-base leading-none w-5 text-center">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: '#141420' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
              J
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: '#9ca3af' }}>James Ignacio</p>
              <p className="text-xs" style={{ color: '#4a4a6a' }}>Zamboanga City</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex"
        style={{ background: '#07070d', borderColor: '#141420' }}>
        {nav.map(({ href, short, icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 transition-colors"
              style={{ color: active ? '#818cf8' : '#4a4a6a' }}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="text-[10px] font-medium leading-tight">{short}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
