'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface AdStat {
  ad_ref: string
  leads: number
  booked: number
  revenue: number
}

export default function AdsPage() {
  const [stats, setStats] = useState<AdStat[]>([])
  const [organicLeads, setOrganicLeads] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const db = createClient()

      // Get all leads with source = facebook
      const { data: leads } = await db
        .from('leads')
        .select('ad_ref, status')
        .eq('source', 'facebook')

      if (!leads) { setLoading(false); return }

      // Get bookings linked to facebook leads for revenue
      const { data: bookings } = await db
        .from('bookings')
        .select('lead_id, craftifyle_income, package_price')

      const bookingMap = new Map<string, number>()
      for (const b of bookings ?? []) {
        if (b.lead_id) {
          bookingMap.set(b.lead_id, b.craftifyle_income || b.package_price || 0)
        }
      }

      // Get lead ids for revenue lookup
      const { data: leadsFull } = await db
        .from('leads')
        .select('id, ad_ref, status')
        .eq('source', 'facebook')

      // Group by ad_ref
      const map = new Map<string, AdStat>()
      let organic = 0

      for (const lead of leadsFull ?? []) {
        const ref = lead.ad_ref ?? null
        if (!ref) { organic++; continue }

        if (!map.has(ref)) {
          map.set(ref, { ad_ref: ref, leads: 0, booked: 0, revenue: 0 })
        }
        const stat = map.get(ref)!
        stat.leads++
        if (['booked', 'completed'].includes(lead.status)) {
          stat.booked++
          stat.revenue += bookingMap.get(lead.id) ?? 0
        }
      }

      setStats(Array.from(map.values()).sort((a, b) => b.revenue - a.revenue))
      setOrganicLeads(organic)
      setLoading(false)
    }
    load()
  }, [])

  const totalLeads = stats.reduce((s, r) => s + r.leads, 0) + organicLeads
  const totalBooked = stats.reduce((s, r) => s + r.booked, 0)
  const totalRevenue = stats.reduce((s, r) => s + r.revenue, 0)

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Ad Performance</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Leads tagged with ad sources via m.me/craftifylePH?ref=your_ad_name
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total FB Leads" value={totalLeads.toString()} color="indigo" />
        <SummaryCard label="Booked" value={totalBooked.toString()} color="green" />
        <SummaryCard
          label="Conversion"
          value={totalLeads > 0 ? `${Math.round((totalBooked / totalLeads) * 100)}%` : '—'}
          color="purple"
        />
        <SummaryCard label="Ad Revenue" value={`₱${totalRevenue.toLocaleString()}`} color="amber" />
      </div>

      {loading ? (
        <div className="card overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
              <div className="skeleton h-4 w-36" />
              <div className="skeleton h-4 w-10 ml-auto" />
              <div className="skeleton h-4 w-10" />
              <div className="skeleton h-4 w-14" />
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      ) : stats.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>No ad-tagged leads yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            To track ads, share this link instead of your regular page link:
          </p>
          <code className="px-3 py-1.5 rounded-lg text-sm font-mono" style={{ background: 'var(--subtle-bg)', color: 'var(--accent-text)', border: '1px solid var(--card-border)' }}>
            m.me/craftifylePH?ref=your_ad_name
          </code>
          <p className="text-xs mt-3" style={{ color: 'var(--text-faint)' }}>
            e.g. ?ref=summer_debut_ad or ?ref=fb_story_june
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--card-elevated)', borderBottom: '1px solid var(--card-border)' }}>
              <tr>
                <th className="section-label text-left px-5 py-3">Ad / Source</th>
                <th className="section-label text-right px-5 py-3">Leads</th>
                <th className="section-label text-right px-5 py-3">Booked</th>
                <th className="section-label text-right px-5 py-3">Conv. Rate</th>
                <th className="section-label text-right px-5 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.ad_ref} style={{ borderTop: '1px solid var(--border-secondary)' }} className="transition-colors hover:bg-[var(--hover-bg)]">
                  <td className="px-5 py-4">
                    <span className="font-medium" style={{ color: 'var(--text-heading)' }}>{row.ad_ref}</span>
                  </td>
                  <td className="px-5 py-4 tabular text-right" style={{ color: 'var(--text-secondary)' }}>{row.leads}</td>
                  <td className="px-5 py-4 tabular text-right font-medium" style={{ color: 'var(--success)' }}>{row.booked}</td>
                  <td className="px-5 py-4 tabular text-right font-medium" style={{ color: 'var(--accent-text)' }}>
                    {row.leads > 0 ? `${Math.round((row.booked / row.leads) * 100)}%` : '—'}
                  </td>
                  <td className="px-5 py-4 tabular text-right font-semibold" style={{ color: 'var(--text-heading)' }}>
                    ₱{row.revenue.toLocaleString()}
                  </td>
                </tr>
              ))}
              {organicLeads > 0 && (
                <tr style={{ borderTop: '1px solid var(--border-secondary)', background: 'var(--subtle-bg)' }}>
                  <td className="px-5 py-4 italic" style={{ color: 'var(--text-faint)' }}>Organic / No ref tag</td>
                  <td className="px-5 py-4 tabular text-right" style={{ color: 'var(--text-faint)' }}>{organicLeads}</td>
                  <td className="px-5 py-4 text-right" style={{ color: 'var(--text-faint)' }}>—</td>
                  <td className="px-5 py-4 text-right" style={{ color: 'var(--text-faint)' }}>—</td>
                  <td className="px-5 py-4 text-right" style={{ color: 'var(--text-faint)' }}>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-xl p-4 text-sm" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle2)', color: 'var(--accent-text)' }}>
        <p className="font-semibold mb-1">💡 How to tag your ads</p>
        <p style={{ color: 'var(--text-secondary)' }}>When boosting a post or running an ad, set the destination URL to:</p>
        <code className="block mt-2 rounded-lg px-3 py-2 text-xs font-mono" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--accent-text)' }}>
          m.me/craftifylePH?ref=name_of_your_ad
        </code>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Every client who clicks that link and messages you will be tagged with that ad source automatically.
        </p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const vars: Record<string, { bg: string; text: string }> = {
    indigo: { bg: 'var(--accent-subtle)', text: 'var(--accent-text)' },
    green:  { bg: 'var(--success-muted)', text: 'var(--success)' },
    purple: { bg: 'var(--accent-subtle)', text: 'var(--accent-text)' },
    amber:  { bg: 'var(--warning-muted)', text: 'var(--warning)' },
  }
  const v = vars[color] ?? vars.indigo
  return (
    <div className="rounded-xl p-4" style={{ background: v.bg, border: '1px solid var(--card-border)' }}>
      <p className="section-label">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular" style={{ color: v.text }}>{value}</p>
    </div>
  )
}
