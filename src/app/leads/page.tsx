'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Lead, LeadStatus } from '@/types'

const STATUSES: LeadStatus[] = [
  'new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost', 'completed',
]

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  quoted: 'bg-orange-100 text-orange-700',
  negotiating: 'bg-purple-100 text-purple-700',
  booked: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtShort(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  })
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all')
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()))

  useEffect(() => {
    const db = createClient()
    db.from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLeads(data ?? [])
        setLoading(false)
      })
  }, [])

  const now = Date.now()
  const coldLeads = leads.filter((l) => {
    if (!['contacted', 'quoted', 'negotiating'].includes(l.status)) return false
    const daysSince = (now - new Date(l.updated_at).getTime()) / 86400000
    return daysSince >= 5
  }).sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())

  const years = Array.from(
    new Set(leads.map((l) => l.created_at.slice(0, 4)))
  ).sort((a, b) => b.localeCompare(a))

  const currentYear = String(new Date().getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const filtered = leads.filter((l) => {
    const matchYear = l.created_at.startsWith(selectedYear)
    const matchSearch =
      search === '' ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone ?? '').includes(search) ||
      (l.facebook ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || l.status === filterStatus
    return matchYear && matchSearch && matchStatus
  })

  const yearLeads = leads.filter((l) => l.created_at.startsWith(selectedYear))
  const statCounts = STATUSES.reduce((acc, s) => {
    acc[s] = yearLeads.filter((l) => l.status === s).length
    return acc
  }, {} as Record<LeadStatus, number>)

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm mt-0.5">All inquiries in one place</p>
        </div>
        <Link
          href="/leads/new"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          + New Lead
        </Link>
      </div>

      {/* Cold Lead Alert */}
      {!loading && coldLeads.length > 0 && (
        <div className="mb-5 rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔥</span>
            <p className="text-sm font-semibold" style={{ color: '#f87171' }}>
              {coldLeads.length} lead{coldLeads.length !== 1 ? 's' : ''} going cold — no activity in 5+ days
            </p>
          </div>
          <div className="space-y-2">
            {coldLeads.slice(0, 5).map((l) => {
              const days = Math.floor((now - new Date(l.updated_at).getTime()) / 86400000)
              const heat = days >= 14 ? { color: '#ef4444', label: 'Very cold' } : days >= 7 ? { color: '#f97316', label: 'Cold' } : { color: '#eab308', label: 'Warm' }
              return (
                <Link
                  key={l.id}
                  href={`/leads/${l.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg transition-colors"
                  style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = heat.color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${heat.color}20`, color: heat.color }}>
                      {heat.label}
                    </span>
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{l.name}</span>
                    <span className="text-xs capitalize hidden sm:inline" style={{ color: 'var(--text-faint)' }}>{l.status}</span>
                  </div>
                  <span className="text-xs shrink-0 ml-2" style={{ color: 'var(--text-faint)' }}>{days}d silent →</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Year selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-gray-500 font-medium mr-1">Year:</span>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`text-sm px-4 py-1.5 rounded-full border font-semibold transition-colors ${
              selectedYear === y
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Status filter pills */}
      {!loading && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize ${
                filterStatus === s
                  ? STATUS_COLORS[s] + ' border-current'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {s}
              <span className={`text-xs font-bold ${filterStatus === s ? '' : 'text-gray-400'}`}>
                {statCounts[s]}
              </span>
            </button>
          ))}
          {filterStatus !== 'all' && (
            <button
              onClick={() => setFilterStatus('all')}
              className="text-xs px-3 py-1.5 text-indigo-600 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, Facebook…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">
            {yearLeads.length === 0
              ? `No leads for ${selectedYear} yet.`
              : 'No leads match your search.'}
          </p>
          {leads.length === 0 && (
            <Link href="/leads/new" className="mt-3 inline-block text-indigo-600 text-sm hover:underline">
              Add your first lead →
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Budget</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Added</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                        {lead.name}
                      </Link>
                      {lead.phone && <p className="text-xs text-gray-400">{lead.phone}</p>}
                    </td>
                    <td className="px-5 py-3 text-gray-600 capitalize">
                      {lead.event_type?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {lead.event_date ? fmt(lead.event_date) : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {lead.budget ? `₱${lead.budget.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 capitalize">{lead.source}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{fmt(lead.created_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}>
                        {lead.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              {filtered.length} lead{filtered.length !== 1 ? 's' : ''} shown
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="block bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{lead.name}</p>
                    {lead.phone && <p className="text-xs text-gray-400">{lead.phone}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STATUS_COLORS[lead.status]}`}>
                    {lead.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                  {lead.event_type && (
                    <span className="capitalize">{lead.event_type.replace('_', ' ')}</span>
                  )}
                  {lead.event_date && (
                    <span>📅 {fmtShort(lead.event_date)}</span>
                  )}
                  {lead.budget && (
                    <span>₱{lead.budget.toLocaleString()}</span>
                  )}
                  <span className="ml-auto text-gray-300">{fmtShort(lead.created_at)}</span>
                </div>
              </Link>
            ))}
            <p className="text-xs text-gray-400 text-center pt-1">
              {filtered.length} lead{filtered.length !== 1 ? 's' : ''} shown
            </p>
          </div>
        </>
      )}
    </div>
  )
}
