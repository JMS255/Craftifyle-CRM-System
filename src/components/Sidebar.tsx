'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from './ThemeProvider'

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}
function HomeIcon()     { return <Icon d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z M9 21V12h6v9" /> }
function LeadsIcon()    { return <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" /> }
function BookingsIcon() { return <Icon d="M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z M9 14l2 2 4-4" /> }
function AdsIcon()      { return <Icon d="M18 20V10 M12 20V4 M6 20v-6" /> }
function FinanceIcon()  { return <Icon d="M12 2a10 10 0 100 20 10 10 0 000-20z M12 6v6l4 2" /> }
function PackagesIcon() { return <Icon d="M12 2l9 4.5v11L12 22 3 17.5v-11L12 2z M12 22V12 M3 6.5l9 5.5 9-5.5" /> }
function InboxIcon()    { return <Icon d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /> }

const nav = [
  { href: '/',         label: 'Dashboard',     short: 'Home',     icon: <HomeIcon /> },
  { href: '/leads',    label: 'Leads',          short: 'Leads',    icon: <LeadsIcon /> },
  { href: '/inbox',    label: 'Messenger',      short: 'Inbox',    icon: <InboxIcon /> },
  { href: '/bookings', label: 'Bookings',       short: 'Bookings', icon: <BookingsIcon /> },
  { href: '/ads',      label: 'Ad Performance', short: 'Ads',      icon: <AdsIcon /> },
  { href: '/personal', label: 'Finances',       short: 'Money',    icon: <FinanceIcon /> },
  { href: '/settings', label: 'Packages',       short: 'Packages', icon: <PackagesIcon /> },
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
  const [isStaff, setIsStaff] = useState(false)

  async function loadProfile() {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')
    const { data } = await db.from('profiles').select('full_name, business_name, location').eq('id', user.id).maybeSingle()
    setProfile(data ?? { full_name: null, business_name: null, location: null })
    // Check if user is a staff member on someone else's team
    const { data: invite } = await db.from('team_invites')
      .select('id').eq('member_user_id', user.id).eq('status', 'accepted').maybeSingle()
    setIsStaff(!!invite)
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
          {nav.filter(({ href }) => !isStaff || ['/', '/leads', '/bookings'].includes(href)).map(({ href, label, icon }) => {
            const active = isActive(href)
            return (
              <Link key={href} href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
                style={{
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  color: active ? 'var(--text-heading)' : 'var(--text-muted)',
                  fontWeight: active ? 500 : 400,
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  marginLeft: '-1px',
                }}>
                <span className="w-5 flex items-center justify-center shrink-0">{icon}</span>
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
            <Link href="/inbox" onClick={() => setQuickAdd(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}>
              <span>💬</span> Messenger Inbox
            </Link>
            <button onClick={() => setQuickAdd(false)}
              className="w-full py-2.5 rounded-xl text-sm font-medium mt-1"
              style={{ color: 'var(--text-faint)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Fills any gap below nav on all devices */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-39 h-16" style={{ background: 'var(--bg)' }} />

      {/* Mobile bottom nav */}
      <nav
        className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex transition-colors print:hidden"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {/* Home + Leads */}
        {nav.slice(0, 2).map(({ href, short, icon }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center pt-2 pb-3 gap-1 transition-colors"
              style={{
                color: active ? 'var(--accent-text)' : 'var(--text-faint)',
                background: active ? 'var(--accent-subtle)' : 'transparent',
              }}>
              {icon}
              <span className="text-[10px] font-medium leading-tight">{short}</span>
            </Link>
          )
        })}

        {/* Centre + Quick Add */}
        <button onClick={() => setQuickAdd(true)}
          className="flex-1 flex flex-col items-center pt-1.5 pb-3 gap-0.5">
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ background: 'var(--accent)', boxShadow: '0 0 16px var(--accent-glow)' }}>+</span>
        </button>

        {/* Bookings only */}
        {nav.slice(2, 3).map(({ href, short, icon }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center pt-2 pb-3 gap-1 transition-colors"
              style={{
                color: active ? 'var(--accent-text)' : 'var(--text-faint)',
                background: active ? 'var(--accent-subtle)' : 'transparent',
              }}>
              {icon}
              <span className="text-[10px] font-medium leading-tight">{short}</span>
            </Link>
          )
        })}

        {/* Profile */}
        <Link href="/profile"
          className="flex-1 flex flex-col items-center pt-2 pb-3 gap-1 transition-colors"
          style={{
            color: pathname === '/profile' ? 'var(--accent-text)' : 'var(--text-faint)',
            background: pathname === '/profile' ? 'var(--accent-subtle)' : 'transparent',
          }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
          <span className="text-[10px] font-medium leading-tight">Profile</span>
        </Link>
      </nav>
    </>
  )
}
