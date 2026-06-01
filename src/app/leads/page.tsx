'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase'
import type { Lead, LeadStatus } from '@/types'

const STATUSES: LeadStatus[] = [
  'new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost', 'completed',
]

const STATUS_COLORS: Record<LeadStatus, { bg: string; color: string }> = {
  new:         { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  contacted:   { bg: 'rgba(234,179,8,0.12)',   color: '#fbbf24' },
  quoted:      { bg: 'rgba(249,115,22,0.12)',  color: '#fb923c' },
  negotiating: { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
  booked:      { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
  lost:        { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
  completed:   { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af' },
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

interface NextAction { label: string; color: string; bg: string }

function getNextAction(lead: Lead): NextAction | null {
  if (['booked', 'completed', 'lost'].includes(lead.status)) return null
  const now = Date.now()
  const eventMs = lead.event_date ? new Date(lead.event_date).getTime() : null
  const daysToEvent = eventMs != null ? Math.floor((eventMs - now) / 86400000) : null
  const daysSilent = Math.floor((now - new Date(lead.updated_at).getTime()) / 86400000)

  if (daysToEvent != null && daysToEvent < 0)
    return { label: '⚠ Event passed — close it', color: '#f87171', bg: 'rgba(239,68,68,0.12)' }
  if (daysToEvent != null && daysToEvent <= 3)
    return { label: `⚡ Event in ${daysToEvent}d — confirm!`, color: '#fb923c', bg: 'rgba(249,115,22,0.12)' }
  if (daysToEvent != null && daysToEvent <= 14)
    return { label: `📅 ${daysToEvent}d to event`, color: '#fbbf24', bg: 'rgba(234,179,8,0.12)' }
  if (['quoted', 'negotiating'].includes(lead.status) && daysSilent >= 7)
    return { label: '🔔 Follow up now', color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' }
  if (lead.status === 'new' && daysSilent >= 3)
    return { label: '📞 First contact needed', color: '#818cf8', bg: 'rgba(99,102,241,0.12)' }
  return null
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
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [kanbanCol, setKanbanCol] = useState<LeadStatus>('new')

  useEffect(() => {
    const saved = localStorage.getItem('leads-view') as 'list' | 'kanban'
    if (saved) setView(saved)
  }, [])

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

  function toggleView(v: 'list' | 'kanban') {
    setView(v)
    localStorage.setItem('leads-view', v)
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const newStatus = result.destination.droppableId as LeadStatus
    if (newStatus === result.source.droppableId) return
    const leadId = result.draggableId
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    const db = createClient()
    await db.from('leads').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', leadId)
  }

  const KANBAN_COLS: LeadStatus[] = ['new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost']
  const kanbanBase = leads.filter(l => {
    const matchYear = l.created_at.startsWith(selectedYear)
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.phone ?? '').includes(search)
    return matchYear && matchSearch
  })
  const kanbanGroups = KANBAN_COLS.reduce((acc, s) => {
    acc[s] = kanbanBase.filter(l => l.status === s)
    return acc
  }, {} as Record<LeadStatus, Lead[]>)

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
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--card-border)' }}>
            <button onClick={() => toggleView('list')} className="text-xs px-3 py-1.5 font-medium transition-colors"
              style={{ background: view === 'list' ? '#6366f1' : 'var(--subtle-bg)', color: view === 'list' ? '#fff' : 'var(--text-muted)' }}>
              ☰ List
            </button>
            <button onClick={() => toggleView('kanban')} className="text-xs px-3 py-1.5 font-medium transition-colors"
              style={{ background: view === 'kanban' ? '#6366f1' : 'var(--subtle-bg)', color: view === 'kanban' ? '#fff' : 'var(--text-muted)' }}>
              ⬜ Board
            </button>
          </div>
          <Link href="/leads/new" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
            + New Lead
          </Link>
        </div>
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

      {/* Status filter pills — list mode only */}
      {!loading && view === 'list' && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all capitalize"
              style={filterStatus === s
                ? { background: STATUS_COLORS[s].bg, color: STATUS_COLORS[s].color, border: `1px solid ${STATUS_COLORS[s].color}40` }
                : { background: 'transparent', color: 'var(--text-faint)', border: '1px solid var(--card-border)' }
              }
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
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)', color: 'var(--text-heading)' }}
        />
      </div>

      {/* Kanban Board */}
      {!loading && view === 'kanban' && (
        <>
        {/* Mobile: stage tab selector */}
        <div className="md:hidden flex gap-1 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {KANBAN_COLS.map(col => {
            const count = kanbanGroups[col].length
            const colDot: Record<LeadStatus, string> = { new:'#3b82f6', contacted:'#eab308', quoted:'#f97316', negotiating:'#8b5cf6', booked:'#10b981', lost:'#ef4444', completed:'#6b7280' }
            return (
              <button key={col} onClick={() => setKanbanCol(col)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all capitalize"
                style={{ background: kanbanCol === col ? colDot[col] + '20' : 'var(--subtle-bg)', border: `1px solid ${kanbanCol === col ? colDot[col] : 'var(--card-border)'}`, color: kanbanCol === col ? colDot[col] : 'var(--text-faint)' }}>
                {col} <span className="opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
        </>
      )}
      {!loading && view === 'kanban' && (
        <DragDropContext onDragEnd={onDragEnd}>
          {/* Desktop: all columns side by side */}
          <div className="hidden md:flex gap-3 overflow-x-auto pb-6 -mx-1 px-1">
            {KANBAN_COLS.map(col => {
              const colColors: Record<LeadStatus, { bg: string; text: string; dot: string }> = {
                new:         { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', dot: '#3b82f6' },
                contacted:   { bg: 'rgba(234,179,8,0.12)',   text: '#facc15', dot: '#eab308' },
                quoted:      { bg: 'rgba(249,115,22,0.12)',  text: '#fb923c', dot: '#f97316' },
                negotiating: { bg: 'rgba(139,92,246,0.12)',  text: '#a78bfa', dot: '#8b5cf6' },
                booked:      { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', dot: '#10b981' },
                lost:        { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', dot: '#ef4444' },
                completed:   { bg: 'rgba(107,114,128,0.12)', text: '#9ca3af', dot: '#6b7280' },
              }
              const c = colColors[col]
              return (
                <div key={col} className="flex-shrink-0 w-56">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
                    <span className="text-xs font-semibold uppercase tracking-wider capitalize" style={{ color: c.text }}>{col}</span>
                    <span className="text-xs ml-auto font-medium" style={{ color: 'var(--text-faint)' }}>{kanbanGroups[col].length}</span>
                  </div>
                  <Droppable droppableId={col}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="min-h-32 rounded-xl p-2 space-y-2 transition-colors"
                        style={{ background: snapshot.isDraggingOver ? c.bg : 'var(--subtle-bg)', border: '1px solid var(--card-border)' }}
                      >
                        {kanbanGroups[col].map((lead, i) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={i}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className="rounded-lg p-3 text-xs cursor-grab active:cursor-grabbing"
                                style={{
                                  background: snap.isDragging ? 'var(--accent-subtle)' : 'var(--card)',
                                  border: '1px solid var(--card-border)',
                                  boxShadow: snap.isDragging ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
                                  ...prov.draggableProps.style,
                                }}
                              >
                                <Link href={`/leads/${lead.id}`} onClick={e => e.stopPropagation()}>
                                  <p className="font-semibold mb-1 truncate hover:text-indigo-400 transition-colors" style={{ color: 'var(--text-heading)' }}>{lead.name}</p>
                                </Link>
                                {lead.event_type && <p className="capitalize mb-0.5" style={{ color: 'var(--text-faint)' }}>{lead.event_type.replace('_', ' ')}</p>}
                                {lead.event_date && <p style={{ color: 'var(--text-faint)' }}>📅 {fmtShort(lead.event_date)}</p>}
                                {lead.budget && <p style={{ color: 'var(--text-faint)' }}>₱{lead.budget.toLocaleString()}</p>}
                                {(() => { const a = getNextAction(lead); return a ? <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: a.bg, color: a.color }}>{a.label}</span> : null })()}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {kanbanGroups[col].length === 0 && (
                          <p className="text-xs text-center py-4" style={{ color: 'var(--text-faint)' }}>empty</p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
          {/* Mobile: single column */}
          <div className="md:hidden space-y-2">
            {kanbanGroups[kanbanCol].map((lead, i) => {
              const a = getNextAction(lead)
              return (
                <div key={lead.id} className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                  <Link href={`/leads/${lead.id}`}>
                    <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-heading)' }}>{lead.name}</p>
                  </Link>
                  {lead.event_type && <p className="text-xs capitalize" style={{ color: 'var(--text-faint)' }}>{lead.event_type.replace('_', ' ')}</p>}
                  {lead.event_date && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>📅 {fmtShort(lead.event_date)}</p>}
                  {lead.budget && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>₱{lead.budget.toLocaleString()}</p>}
                  {a && <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full" style={{ background: a.bg, color: a.color }}>{a.label}</span>}
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {KANBAN_COLS.filter(c => c !== kanbanCol).map(c => (
                      <button key={c} onClick={() => onDragEnd({ draggableId: lead.id, destination: { droppableId: c, index: 0 }, source: { droppableId: kanbanCol, index: i }, type: 'DEFAULT', mode: 'FLUID', reason: 'DROP', combine: null })}
                        className="text-xs px-2 py-1 rounded-lg capitalize transition-colors"
                        style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-faint)' }}>
                        → {c}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {kanbanGroups[kanbanCol].length === 0 && (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--text-faint)' }}>No leads in this stage</p>
            )}
          </div>
        </DragDropContext>
      )}

      {!loading && view === 'kanban' ? null : loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="text-4xl mb-3">◎</div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
            {yearLeads.length === 0 ? `No leads for ${selectedYear} yet.` : 'No leads match your search.'}
          </p>
          {leads.length === 0 && (
            <>
              <p className="text-sm mb-5" style={{ color: 'var(--text-faint)' }}>
                Got a Messenger DM? Paste it — Crafty will extract the details and create the lead instantly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: { prompt: 'Parse this client inquiry and create a lead: ', mode: 'crm' } }))}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  📋 Paste a Messenger Inquiry
                </button>
                <Link href="/leads/new"
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                  + Add manually
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
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
                      {(() => { const a = getNextAction(lead); return a ? <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: a.bg, color: a.color }}>{a.label}</span> : null })()}
                    </td>
                    <td className="px-5 py-3">
                      <p style={{ color: 'var(--text-secondary)' }} className="capitalize">{lead.event_type?.replace('_', ' ') ?? '—'}</p>
                      {lead.package && <p className="text-xs mt-0.5 truncate max-w-[140px]" style={{ color: 'var(--text-faint)' }}>{lead.package}</p>}
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
                      <span className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                        style={{ background: STATUS_COLORS[lead.status].bg, color: STATUS_COLORS[lead.status].color }}>
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
                className="block card px-4 py-3 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{lead.name}</p>
                    {lead.phone && <p className="text-xs text-gray-400">{lead.phone}</p>}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium shrink-0 capitalize"
                    style={{ background: STATUS_COLORS[lead.status].bg, color: STATUS_COLORS[lead.status].color }}>
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
                {(() => { const a = getNextAction(lead); return a ? <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: a.bg, color: a.color }}>{a.label}</span> : null })()}
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
