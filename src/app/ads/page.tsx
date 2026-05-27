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
        <h1 className="text-2xl font-bold text-gray-900">Ad Performance</h1>
        <p className="text-sm text-gray-400 mt-1">
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
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : stats.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 font-medium mb-2">No ad-tagged leads yet</p>
          <p className="text-gray-400 text-sm mb-4">
            To track ads, share this link instead of your regular page link:
          </p>
          <code className="bg-gray-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-mono">
            m.me/craftifylePH?ref=your_ad_name
          </code>
          <p className="text-gray-400 text-xs mt-3">
            e.g. ?ref=summer_debut_ad or ?ref=fb_story_june
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs text-gray-400 uppercase px-5 py-3">Ad / Source</th>
                <th className="text-right text-xs text-gray-400 uppercase px-5 py-3">Leads</th>
                <th className="text-right text-xs text-gray-400 uppercase px-5 py-3">Booked</th>
                <th className="text-right text-xs text-gray-400 uppercase px-5 py-3">Conv. Rate</th>
                <th className="text-right text-xs text-gray-400 uppercase px-5 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.map((row) => (
                <tr key={row.ad_ref} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <span className="font-medium text-gray-800">{row.ad_ref}</span>
                  </td>
                  <td className="px-5 py-4 text-right text-gray-600">{row.leads}</td>
                  <td className="px-5 py-4 text-right text-green-600 font-medium">{row.booked}</td>
                  <td className="px-5 py-4 text-right text-purple-600 font-medium">
                    {row.leads > 0 ? `${Math.round((row.booked / row.leads) * 100)}%` : '—'}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-gray-800">
                    ₱{row.revenue.toLocaleString()}
                  </td>
                </tr>
              ))}
              {organicLeads > 0 && (
                <tr className="bg-gray-50">
                  <td className="px-5 py-4 text-gray-400 italic">Organic / No ref tag</td>
                  <td className="px-5 py-4 text-right text-gray-400">{organicLeads}</td>
                  <td className="px-5 py-4 text-right text-gray-400">—</td>
                  <td className="px-5 py-4 text-right text-gray-400">—</td>
                  <td className="px-5 py-4 text-right text-gray-400">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-700">
        <p className="font-semibold mb-1">💡 How to tag your ads</p>
        <p>When boosting a post or running an ad, set the destination URL to:</p>
        <code className="block mt-2 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-mono">
          m.me/craftifylePH?ref=name_of_your_ad
        </code>
        <p className="text-xs text-indigo-500 mt-2">
          Every client who clicks that link and messages you will be tagged with that ad source automatically.
        </p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}
