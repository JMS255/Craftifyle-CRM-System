'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useTheme } from './ThemeProvider'

const nav = [
  { href: '/', label: 'Dashboard', short: 'Home', icon: '⊞' },
  { href: '/leads', label: 'Leads', short: 'Leads', icon: '◎' },
  { href: '/bookings', label: 'Bookings', short: 'Events', icon: '◈' },
  { href: '/ads', label: 'Ad Performance', short: 'Ads', icon: '◉' },
  { href: '/personal', label: 'Finances', short: 'Money', icon: '◇' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  async function signOut() {
    const db = createClient()
    await db.auth.signOut()
    router.replace('/login')
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col shrink-0 w-56 min-h-screen border-r transition-colors"
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
      >
        {/* Logo */}
        <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              C
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-heading)' }}>
                Craftifyle
              </p>
              <p className="text-xs leading-tight" style={{ color: 'var(--text-faint)' }}>CRM</p>
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
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  color: active ? 'var(--accent-text)' : 'var(--text-muted)',
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <span className="text-base leading-none w-5 text-center">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: 'var(--sidebar-border)' }}>
          {/* User */}
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
            >
              J
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                James Ignacio
              </p>
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Zamboanga City</p>
            </div>
          </div>

          {/* Theme toggle + sign out row */}
          <div className="flex items-center justify-between">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              style={{
                background: 'var(--subtle-bg)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-muted)',
              }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="text-sm leading-none">
                {theme === 'dark' ? '☀️' : '🌙'}
              </span>
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            {/* Sign out */}
            <button
              onClick={signOut}
              className="text-xs px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-faint)' }}
            >
              Sign out →
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex transition-colors"
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
      >
        {nav.map(({ href, short, icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 transition-colors"
              style={{ color: active ? '#818cf8' : 'var(--text-faint)' }}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="text-[10px] font-medium leading-tight">{short}</span>
            </Link>
          )
        })}
        {/* Theme toggle in mobile nav */}
        <button
          onClick={toggleTheme}
          className="flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 transition-colors"
          style={{ color: 'var(--text-faint)' }}
        >
          <span className="text-lg leading-none">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="text-[10px] font-medium leading-tight">Theme</span>
        </button>
      </nav>
    </>
  )
}
