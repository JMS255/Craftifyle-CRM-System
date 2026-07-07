'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth'
import { auth, getAllDocs } from '@/lib/firebase'
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
function FinanceIcon()  { return <Icon d="M12 2a10 10 0 100 20 10 10 0 000-20z M12 6v6l4 2" /> }
function PackagesIcon() { return <Icon d="M12 2l9 4.5v11L12 22 3 17.5v-11L12 2z M12 22V12 M3 6.5l9 5.5 9-5.5" /> }
function CraftyIcon()   { return <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /> }
function AdsIcon()      { return <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" /> }
function ChevronLeft()  { return <Icon d="M15 18l-6-6 6-6" size={16} /> }
function ChevronRight() { return <Icon d="M9 18l6-6-6-6" size={16} /> }

const nav = [
  { href: '/',         label: 'Dashboard', short: 'Home',     icon: <HomeIcon /> },
  { href: '/bookings', label: 'Bookings',  short: 'Bookings', icon: <BookingsIcon /> },
  { href: '/personal', label: 'Finances',  short: 'Money',    icon: <FinanceIcon /> },
  { href: '/leads',    label: 'Leads',     short: 'Leads',    icon: <LeadsIcon /> },
  { href: '/settings', label: 'Packages',  short: 'Packages', icon: <PackagesIcon /> },
  { href: '/crafty',   label: 'Crafty AI', short: 'Crafty',   icon: <CraftyIcon /> },
  { href: '/ads',      label: 'Ads',       short: 'Ads',      icon: <AdsIcon /> },
]

const AUTH_PATHS = ['/login', '/signup', '/contract/', '/confirm/', '/team/join/']

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
  const [collapsed, setCollapsed] = useState(false)

  const isAuthPage = AUTH_PATHS.some(p => pathname.startsWith(p))

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  async function loadProfile() {
    const user = auth.currentUser
    if (!user) return
    setEmail(user.email ?? '')
    const profiles = await getAllDocs<{ id: string; full_name: string | null; business_name: string | null; location: string | null }>('profiles')
    const p = profiles.find(pr => pr.id === user.uid)
    setProfile(p ?? { full_name: null, business_name: null, location: null })
    const invites = await getAllDocs<{ id: string; member_user_id: string; status: string }>('team_invites')
    setIsStaff(invites.some(i => i.member_user_id === user.uid && i.status === 'accepted'))
  }

  useEffect(() => {
    if (isAuthPage) return
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) loadProfile()
    })
    window.addEventListener('profile-updated', loadProfile)
    return () => {
      unsub()
      window.removeEventListener('profile-updated', loadProfile)
    }
  }, [isAuthPage])

  async function signOut() {
    await firebaseSignOut(auth)
    await fetch('/api/auth/session', { method: 'DELETE' })
    router.replace('/login')
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  if (isAuthPage) return null

  const displayName = profile?.full_name || email.split('@')[0] || 'My Account'
  const displaySub = profile?.business_name || profile?.location || 'Crafty CRM'
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        data-sidebar
        className="hidden md:flex flex-col shrink-0 min-h-screen border-r transition-all duration-200 print:hidden"
        style={{
          width: collapsed ? '4rem' : '14rem',
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
        }}
      >
        {/* Logo + collapse toggle */}
        <div className="px-3 py-5 border-b flex items-center" style={{ borderColor: 'var(--sidebar-border)', justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
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
          )}
          <button
            onClick={toggleCollapsed}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/10 shrink-0"
            style={{ color: 'var(--text-faint)', marginLeft: collapsed ? 'auto' : '0.25rem' }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3">
          {/* Main group */}
          {!collapsed && (
            <p className="px-2 mb-1 mt-1" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Main
            </p>
          )}
          {nav.slice(0, 5).filter(({ href }) => !isStaff || ['/', '/leads', '/bookings'].includes(href)).map(({ href, label, icon }) => {
            const active = isActive(href)
            return (
              <Link key={href} href={href}
                title={collapsed ? label : undefined}
                className="flex items-center gap-3 rounded-md text-sm transition-all duration-150 mb-0.5"
                style={{
                  padding: collapsed ? '0.5rem' : '0.4rem 0.625rem',
                  justifyContent: collapsed ? 'center' : undefined,
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  color: active ? 'var(--accent-text)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 400,
                }}>
                <span className="w-5 flex items-center justify-center shrink-0">{icon}</span>
                {!collapsed && label}
              </Link>
            )
          })}

          {/* Tools group */}
          {!collapsed && (
            <p className="px-2 mb-1 mt-4" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
              Tools
            </p>
          )}
          {collapsed && <div className="my-2" style={{ height: 1, background: 'var(--sidebar-border)' }} />}
          {nav.slice(5).filter(({ href }) => !isStaff || ['/', '/leads', '/bookings'].includes(href)).map(({ href, label, icon }) => {
            const active = isActive(href)
            return (
              <Link key={href} href={href}
                title={collapsed ? label : undefined}
                className="flex items-center gap-3 rounded-md text-sm transition-all duration-150 mb-0.5"
                style={{
                  padding: collapsed ? '0.5rem' : '0.4rem 0.625rem',
                  justifyContent: collapsed ? 'center' : undefined,
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  color: active ? 'var(--accent-text)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 400,
                }}>
                <span className="w-5 flex items-center justify-center shrink-0">{icon}</span>
                {!collapsed && label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: 'var(--sidebar-border)' }}>
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
                className="text-xs px-2 py-1.5 rounded-lg transition-colors hover:bg-white/5 ml-auto whitespace-nowrap"
                style={{ color: 'var(--text-faint)' }}
              >
                Sign out →
              </button>
            </div>
          </div>
        )}

        {/* Collapsed footer — just avatar + sign out */}
        {collapsed && (
          <div className="px-2 py-4 border-t flex flex-col items-center gap-2" style={{ borderColor: 'var(--sidebar-border)' }}>
            <Link href="/profile" title={displayName}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-opacity hover:opacity-80"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {initials}
            </Link>
            <button onClick={signOut} title="Sign out"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-faint)' }}
            >
              <Icon d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9" size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* Quick Add bottom sheet — always mounted for smooth transitions */}
      <div
        className="md:hidden fixed inset-0 z-50"
        style={{
          opacity: quickAdd ? 1 : 0,
          pointerEvents: quickAdd ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
        onClick={() => setQuickAdd(false)}
      >
        {/* Backdrop */}
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />

        {/* Sheet */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--card-border)',
            transform: quickAdd ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--card-border)' }} />

          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>Navigate</p>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { href: '/leads',    label: 'Leads',     icon: '👥' },
              { href: '/settings', label: 'Packages',  icon: '📦' },
              { href: '/crafty',   label: 'Crafty AI', icon: '⚡' },
              { href: '/ads',      label: 'Ads',        icon: '📊' },
            ].map(({ href, label, icon }, i) => (
              <Link key={href} href={href} onClick={() => setQuickAdd(false)}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-sm font-medium"
                style={{
                  background: 'var(--subtle-bg)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-heading)',
                  transform: quickAdd ? 'translateY(0)' : 'translateY(12px)',
                  opacity: quickAdd ? 1 : 0,
                  transition: `transform 0.3s cubic-bezier(0.32, 0.72, 0, 1) ${60 + i * 40}ms, opacity 0.25s ease ${60 + i * 40}ms`,
                }}>
                <span className="text-lg leading-none">{icon}</span>
                <span className="text-xs">{label}</span>
              </Link>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>Quick Add</p>
          <div className="space-y-2">
            {[
              {
                label: 'Add New Lead', icon: '◎', isLink: true, href: '/leads/new',
              },
              {
                label: 'Log a Payment', icon: '💰', isLink: false,
                onClick: () => { setQuickAdd(false); window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: { prompt: 'Log a payment: ', mode: 'crm' } })) },
              },
            ].map(({ label, icon, isLink, href, onClick }, i) => (
              isLink
                ? <Link key={label} href={href!} onClick={() => setQuickAdd(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm"
                    style={{
                      background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)',
                      transform: quickAdd ? 'translateY(0)' : 'translateY(12px)',
                      opacity: quickAdd ? 1 : 0,
                      transition: `transform 0.3s cubic-bezier(0.32, 0.72, 0, 1) ${220 + i * 50}ms, opacity 0.25s ease ${220 + i * 50}ms`,
                    }}>
                    <span>{icon}</span> {label}
                  </Link>
                : <button key={label} onClick={onClick}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm"
                    style={{
                      background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-heading)',
                      transform: quickAdd ? 'translateY(0)' : 'translateY(12px)',
                      opacity: quickAdd ? 1 : 0,
                      transition: `transform 0.3s cubic-bezier(0.32, 0.72, 0, 1) ${220 + i * 50}ms, opacity 0.25s ease ${220 + i * 50}ms`,
                    }}>
                    <span>{icon}</span> {label}
                  </button>
            ))}
          </div>

          <button onClick={() => setQuickAdd(false)}
            className="w-full py-3 rounded-xl text-sm font-medium mt-4"
            style={{ color: 'var(--text-faint)' }}>Cancel</button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex transition-colors print:hidden"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
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

        <button onClick={() => setQuickAdd(true)}
          className="flex-1 flex flex-col items-center pt-1.5 pb-3 gap-0.5">
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ background: 'var(--accent)', boxShadow: '0 0 16px var(--accent-glow)' }}>+</span>
        </button>

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
