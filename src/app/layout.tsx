import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import ChatWidget from '@/components/ChatWidget'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'Craftifyle CRM',
  description: 'Photobooth business management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full flex antialiased" style={{ background: '#0a0a0f' }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0 min-h-screen">
          {children}
        </main>
        <ChatWidget />
      </body>
    </html>
  )
}
