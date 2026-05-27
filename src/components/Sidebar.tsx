'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: 'Dashboard', short: 'Home', icon: '📊' },
  { href: '/leads', label: 'Leads', short: 'Leads', icon: '💬' },
  { href: '/bookings', label: 'Bookings', short: 'Bookings', icon: '📅' },
  { href: '/ads', label: 'Ad Performance', short: 'Ads', icon: '📣' },
  { href: '/personal', label: 'Personal Income', short: 'Finance', icon: '💰' },
]

export default function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 min-h-screen bg-slate-900 flex-col shrink-0">
        <div className="px-5 py-6 border-b border-slate-700">
          <p className="text-white font-bold text-lg leading-tight">Craftifyle</p>
          <p className="text-slate-400 text-xs mt-0.5">Photobooth CRM</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs">Zamboanga City, PH</p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 flex safe-area-inset-bottom">
        {nav.map(({ href, short, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center pt-2 pb-3 gap-0.5 transition-colors ${
              isActive(href) ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span className="text-[10px] font-medium leading-tight">{short}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
