import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import ChatWidget from '@/components/ChatWidget'
import ThemeProvider from '@/components/ThemeProvider'
import OnboardingModal from '@/components/OnboardingModal'
import CraftyToast from '@/components/CraftyToast'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'Crafty CRM',
  description: 'Crafty CRM — Business management for service businesses',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Crafty CRM',
  },
  icons: {
    icon: '/icon-512.png',
    apple: '/apple-touch-icon.png',
  },
}

// Prevent flash of wrong theme before React hydrates
const themeScript = `
  (function() {
    try {
      var saved = localStorage.getItem('craftifyle-theme');
      var osDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var t = saved || 'light';
      document.documentElement.setAttribute('data-theme', t);
    } catch(e) {}
  })();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="theme-color" content="#7c6ff7" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="h-full flex antialiased" style={{ background: 'var(--bg)' }}>
        <ThemeProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0 min-h-screen">
            {children}
          </main>
          <ChatWidget />
          <OnboardingModal />
          <CraftyToast />
        </ThemeProvider>
      </body>
    </html>
  )
}
