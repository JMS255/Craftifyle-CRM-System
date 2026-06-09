'use client'

import { useEffect, useRef, useState } from 'react'
import { auth, getAllDocs } from '@/lib/firebase'

interface Toast {
  id: number
  message: string
}

const TRIGGERS = [
  'crafty:first-lead',
  'crafty:second-lead',
  'crafty:first-stage-change',
  'crafty:first-activity',
  'crafty:five-leads',
  'crafty:first-booking',
] as const

type TriggerEvent = typeof TRIGGERS[number]

const MESSAGES: Record<TriggerEvent, (name?: string) => string> = {
  'crafty:first-lead':         (n) => `Nasa pipeline mo na si ${n ?? 'ang lead'}! 🎯`,
  'crafty:second-lead':        (n) => `Isa pa! Si ${n ?? 'lead #2'} — tuloy na. 💪`,
  'crafty:first-stage-change': (n) => `${n ?? 'Lead'} moved — ikaw ang boss ng pipeline. ✅`,
  'crafty:first-activity':     ()  => `Activity logged! Lahat tracked na. 📝`,
  'crafty:five-leads':         ()  => `5 leads na! Sige, tuloy lang. 🔥`,
  'crafty:first-booking':      (n) => `BOOKING! 💰 Kumita ka na kay ${n ?? 'client'}. 🎉`,
}

let toastCounter = 0

export default function CraftyToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const sessionStart = useRef(Date.now())
  const fired = useRef<Set<TriggerEvent>>(new Set())
  const [active, setActive] = useState(false)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    getAllDocs<{ id: string; onboarding_completed?: boolean }>('profiles').then(profiles => {
      const profile = profiles.find(p => p.id === uid)
      if (profile?.onboarding_completed) setActive(true)
    })
  }, [])

  useEffect(() => {
    if (!active) return

    function handle(e: Event) {
      const elapsed = Date.now() - sessionStart.current
      if (elapsed > 30 * 60 * 1000) return // 30 min window

      const type = (e as CustomEvent).type as TriggerEvent
      if (fired.current.has(type)) return
      fired.current.add(type)

      const name = (e as CustomEvent).detail?.name as string | undefined
      const msg = MESSAGES[type]?.(name)
      if (!msg) return

      const id = ++toastCounter
      setToasts(t => [...t, { id, message: msg }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }

    TRIGGERS.forEach(t => window.addEventListener(t, handle))
    return () => TRIGGERS.forEach(t => window.removeEventListener(t, handle))
  }, [active])

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none md:bottom-6">
      {toasts.map(toast => (
        <div key={toast.id}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-heading)',
            animation: 'crafty-toast-in 0.3s ease',
          }}>
          <div className="w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>C</div>
          {toast.message}
        </div>
      ))}
      <style>{`
        @keyframes crafty-toast-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  )
}
