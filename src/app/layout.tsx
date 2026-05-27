import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import ChatWidget from '@/components/ChatWidget'
import ThemeProvider from '@/components/ThemeProvider'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'Crafty CRM',
  description: 'Crafty CRM — Business management for service businesses',
}

// Prevent flash of wrong theme before React hydrates
const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('craftifyle-theme') || 'dark';
      document.documentElement.setAttribute('data-theme', t);
    } catch(e) {}
  })();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full flex antialiased" style={{ background: 'var(--bg)' }}>
        <ThemeProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0 min-h-screen">
            {children}
          </main>
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  )
}
