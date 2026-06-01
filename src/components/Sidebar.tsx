'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from './ThemeProvider'

const nav = [
  { href: '/', label: 'Dashboard', short: 'Home', icon: '🏠' },
  { href: '/leads', label: 'Leads', short: 'Leads', icon: '📋' },
  { href: '/bookings', label: 'Bookings', short: 'Bookings', icon: '📅' },
  { href: '/ads', label: 'Ad Performance', short: 'Ads', icon: '📊' },
  { href: '/personal', label: 'Finances', short: 'Money', icon: '💰' },
  { href: '/settings', label: 'Packages', short: 'Packages', icon: '⚙️' },
]

interface Profile {
  full_name: string | null
  business_name: string | null
  location: string | null
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [quickAdd, setQuickAdd] = useState(false)

  async function loadProfile() {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')
    const { data } = await db.from('profiles').select('full_name, business_name, location').eq('id', user.id).maybeSingle()
    setProfile(data ?? { full_name: null, business_name: null, location: null })
  }

  useEffect(() => {
    loadProfile()
    // Refresh when profile is saved
    window.addEventListener('profile-updated', loadProfile)
    return () => window.removeEventListener('profile-updated', loadProfile)
  }, [])

  async function signOut() {
    const db = createClient()
    await db.auth.signOut()
    router.replace('/login')
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  const displayName = profile?.full_name || email.split('@')[0] || 'My Account'
  const displaySub = profile?.business_name || profile?.location || 'Crafty CRM'
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        data-sidebar
        className="hidden md:flex flex-col shrink-0 w-56 min-h-screen border-r transition-colors print:hidden"
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
                Crafty CRM
              </p>
              <p className="text-xs leading-tight" style={{ color: 'var(--text-faint)' }}>Beta</p>
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
                style={{
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  color: active ? 'var(--text-heading)' : 'var(--text-muted)',
                  fontWeight: active ? 500 : 400,
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  marginLeft: '-1px',
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
          {/* User — click to go to profile */}
          <Link href="/profile" className="flex items-center gap-2 rounded-xl px-2 py-1.5 -mx-2 transition-colors hover:bg-white/5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                {displayName}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{displaySub}</p>
            </div>
          </Link>

          {/* Theme toggle + tutorial + sign out row */}
          <div className="flex items-center gap-1.5">
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
              <span className="text-sm leading-none">{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            {/* Tutorial button */}
            <button
              onClick={() => window.dispatchEvent(new Event('crafty-open-tutorial'))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
              style={{
                background: 'var(--subtle-bg)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-muted)',
              }}
              title="How to use Crafty CRM"
            >
              ?
            </button>

            <button
              onClick={signOut}
              className="text-xs px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5 ml-auto"
              style={{ color: 'var(--text-faint)' }}
            >
              Sign out →
            </button>
          </div>
        </div>
      </aside>

      {/* Quick Add bottom sheet */}
      {quickAdd && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setQuickAdd(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-5 space-y-3"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
            onClick={e => e.stopPropagation()}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>Quick Add</p>
            <Link href="/leads/new" onClick={() => setQuickAdd(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}>
              <span>◎</span> Add New Lead
            </Link>
            <button onClick={() => { setQuickAdd(false); window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: { prompt: 'Parse this client inquiry and create a lead: ', mode: 'crm' } })) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}>
              <span>📋</span> Paste Messenger DM
            </button>
            <button onClick={() => { setQuickAdd(false); window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: { prompt: 'Log a payment: ', mode: 'crm' } })) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}>
              <span>💰</span> Log a Payment
            </button>
            <button onClick={() => setQuickAdd(false)}
              className="w-full py-2.5 rounded-xl text-sm font-medium mt-1"
              style={{ color: 'var(--text-faint)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav
        className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex transition-colors print:hidden"
        style={{ background: 'rgba(15,15,23,0.85)', borderColor: 'var(--sidebar-border)' }}
      >
        {/* Home + Leads */}
        {nav.slice(0, 2).map(({ href, short, icon }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 transition-colors"
              style={{ color: active ? 'var(--accent-text)' : 'var(--text-faint)' }}>
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] font-medium leading-tight">{short}</span>
            </Link>
          )
        })}

        {/* Centre + Quick Add */}
        <button onClick={() => setQuickAdd(true)}
          className="flex-1 flex flex-col items-center pt-1.5 pb-3 gap-0.5">
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ background: 'var(--accent)', boxShadow: '0 0 16px var(--accent-glow)' }}>+</span>
          <span className="text-[10px] font-medium leading-tight" style={{ color: 'var(--text-faint)' }}>Add</span>
        </button>

        {/* Bookings only */}
        {nav.slice(2, 3).map(({ href, short, icon }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 transition-colors"
              style={{ color: active ? 'var(--accent-text)' : 'var(--text-faint)' }}>
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] font-medium leading-tight">{short}</span>
            </Link>
          )
        })}

        {/* Profile */}
        <Link href="/profile"
          className="flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 transition-colors"
          style={{ color: pathname === '/profile' ? 'var(--accent-text)' : 'var(--text-faint)' }}>
          <span className="text-xl leading-none">👤</span>
          <span className="text-[10px] font-medium leading-tight">Profile</span>
        </Link>
      </nav>
    </>
  )
}
