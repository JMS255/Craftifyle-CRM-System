'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import WelcomeCard from '@/components/WelcomeCard'
import CashPositionCard from '@/components/finance/CashPositionCard'
import DebtScheduleCard from '@/components/finance/DebtScheduleCard'
import ObligationsCard from '@/components/finance/ObligationsCard'
import FinanceAIInput from '@/components/finance/FinanceAIInput'
import TopBar from '@/components/TopBar'

export default function PersonalPage() {
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleRefresh() {
    setRefreshKey(k => k + 1)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { setLoading(false); return }
      setLoading(false)
    })
    return () => unsub()
  }, [refreshKey])

  return (
    <>
      <TopBar
        page="Finances"
        title="Personal Finance"
        subtitle="Your money, separate from Craftifyle"
      />
      <div className="p-4 md:p-8 pb-8">

        <WelcomeCard
          storageKey="welcome-finances"
          icon="💰"
          title="Track your personal money"
          description="Log your income, expenses, and debts separate from your business revenue. Know exactly where your money goes and what you owe every month."
          tips={[
            'Tap any amount in Cash Position to update it instantly',
            'Debt payments are already tracked separately — don\'t log them as expenses too',
          ]}
          accentColor="#10b981"
        />

        {/* AI bar — mobile only, top of page */}
        {!loading && (
          <div className="md:hidden">
            <FinanceAIInput onRefresh={handleRefresh} />
          </div>
        )}

        {/* Responsive two-column layout */}
        <div className="md:grid md:grid-cols-5 md:gap-6 md:items-start">

          {/* LEFT / main column */}
          <div className="md:col-span-3">
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
              </div>
            ) : (
              <>
                <CashPositionCard refreshKey={refreshKey} onRefresh={handleRefresh} />
                <ObligationsCard refreshKey={refreshKey} onRefresh={handleRefresh} />
                <DebtScheduleCard refreshKey={refreshKey} onRefresh={handleRefresh} />
              </>
            )}
          </div>

          {/* RIGHT / AI sidebar — desktop only */}
          <div className="hidden md:block md:col-span-2 md:sticky md:top-4 md:self-start">
            {!loading && <FinanceAIInput onRefresh={handleRefresh} />}
          </div>

        </div>
      </div>
    </>
  )
}
