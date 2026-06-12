'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { getAllDocs, updateDocument } from '@/lib/firebase'
import type { Lead, LeadStatus } from '@/types'

const STATUSES: LeadStatus[] = ['new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost', 'completed']

const STAGE: Record<LeadStatus, { color: string; bg: string; border: string }> = {
  new:         { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  border: '#3b82f6' },
  contacted:   { color: '#fbbf24', bg: 'rgba(234,179,8,0.12)',   border: '#eab308' },
  quoted:      { color: '#fb923c', bg: 'rgba(249,115,22,0.12)',  border: '#f97316' },
  negotiating: { color: '#a78bfa', bg: 'rgba(139,92,246,0.12)',  border: '#8b5cf6' },
  booked:      { color: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: '#10b981' },
  lost:        { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: '#ef4444' },
  completed:   { color: '#9ca3af', bg: 'rgba(107,114,128,0.12)', border: '#6b7280' },
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000)
}
function fmtShort(date: string) {
  return new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}
function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

interface NextAction { label: string; color: string; bg: string }

function getNextAction(lead: Lead): NextAction | null {
  if (['booked', 'completed', 'lost'].includes(lead.status)) return null
  const now = Date.now()
  const daysToEvent = lead.event_date != null ? daysUntil(lead.event_date) : null
  const daysSilent = Math.floor((now - new Date(lead.updated_at).getTime()) / 86400000)
  if (daysToEvent != null && daysToEvent < 0)   return { label: '⚠ Event passed — close it',       color: '#f87171', bg: 'rgba(239,68,68,0.12)' }
  if (daysToEvent != null && daysToEvent <= 3)  return { label: `⚡ Event in ${daysToEvent}d — confirm!`, color: '#fb923c', bg: 'rgba(249,115,22,0.12)' }
  if (daysToEvent != null && daysToEvent <= 14) return { label: `📅 ${daysToEvent}d to event`,       color: '#fbbf24', bg: 'rgba(234,179,8,0.12)' }
  if (['quoted', 'negotiating'].includes(lead.status) && daysSilent >= 7)
    return { label: '🔔 Follow up now',             color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' }
  if (lead.status === 'new' && daysSilent >= 3)
    return { label: '📞 First contact needed',       color: '#818cf8', bg: 'rgba(99,102,241,0.12)' }
  return null
}

function Avatar({ name, status, size = 36 }: { name: string; status: LeadStatus; size?: number }) {
  const s = STAGE[status]
  return (
    <div className="shrink-0 rounded-xl flex items-center justify-center font-bold"
      style={{ width: size, height: size, background: s.bg, color: s.color, fontSize: size * 0.38 }}>
      {initials(name)}
    </div>
  )
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all')
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()))
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [kanbanCol, setKanbanCol] = useState<LeadStatus>('new')
  const [undoInfo, setUndoInfo] = useState<{ id: string; name: string; prevStatus: LeadStatus } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('leads-view') as 'list' | 'kanban'
    if (saved) setView(saved)
  }, [])

  useEffect(() => {
    getAllDocs<Lead>('leads').then(data => {
      setLeads([...data].sort((a, b) => b.created_at.localeCompare(a.created_at)))
      setLoading(false)
    })
  }, [])

  function toggleView(v: 'list' | 'kanban') { setView(v); localStorage.setItem('leads-view', v) }

  async function handleSwipeAction(leadId: string, newStatus: LeadStatus, prevStatus: LeadStatus, leadName: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus, updated_at: new Date().toISOString() } : l))
    await updateDocument('leads', leadId, { status: newStatus, updated_at: new Date().toISOString() })
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoInfo({ id: leadId, name: leadName, prevStatus })
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 4000)
  }

  async function handleUndo() {
    if (!undoInfo) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setLeads(prev => prev.map(l => l.id === undoInfo.id ? { ...l, status: undoInfo.prevStatus } : l))
    await updateDocument('leads', undoInfo.id, { status: undoInfo.prevStatus, updated_at: new Date().toISOString() })
    setUndoInfo(null)
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const newStatus = result.destination.droppableId as LeadStatus
    if (newStatus === result.source.droppableId) return
    const leadId = result.draggableId
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    await updateDocument('leads', leadId, { status: newStatus, updated_at: new Date().toISOString() })
  }

  const KANBAN_COLS: LeadStatus[] = ['new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost']

  const kanbanBase = leads.filter(l =>
    l.created_at.startsWith(selectedYear) &&
    (!search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.phone ?? '').includes(search))
  )
  const kanbanGroups = KANBAN_COLS.reduce((acc, s) => {
    acc[s] = kanbanBase.filter(l => l.status === s); return acc
  }, {} as Record<LeadStatus, Lead[]>)

  const now = Date.now()
  const coldLeads = leads.filter(l => {
    if (!['contacted', 'quoted', 'negotiating'].includes(l.status)) return false
    return (now - new Date(l.updated_at).getTime()) / 86400000 >= 5
  }).sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())

  const years = Array.from(new Set(leads.map(l => l.created_at.slice(0, 4)))).sort((a, b) => b.localeCompare(a))
  const currentYear = String(new Date().getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const filtered = leads.filter(l => {
    const matchYear = l.created_at.startsWith(selectedYear)
    const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone ?? '').includes(search) || (l.facebook ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' ? l.status !== 'lost' : l.status === filterStatus
    return matchYear && matchSearch && matchStatus
  })

  const yearLeads = leads.filter(l => l.created_at.startsWith(selectedYear))
  const statCounts = STATUSES.reduce((acc, s) => {
    acc[s] = yearLeads.filter(l => l.status === s).length; return acc
  }, {} as Record<LeadStatus, number>)

  return (
    <div className="p-4 md:p-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {yearLeads.length} leads in {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
            <button onClick={() => toggleView('list')} className="text-xs px-3 py-1.5 font-medium transition-colors"
              style={{ background: view === 'list' ? 'var(--accent)' : 'var(--subtle-bg)', color: view === 'list' ? '#fff' : 'var(--text-muted)' }}>
              ☰ List
            </button>
            <button onClick={() => toggleView('kanban')} className="text-xs px-3 py-1.5 font-medium transition-colors"
              style={{ background: view === 'kanban' ? 'var(--accent)' : 'var(--subtle-bg)', color: view === 'kanban' ? '#fff' : 'var(--text-muted)' }}>
              ⬜ Board
            </button>
          </div>
          <Link href="/leads/new"
            className="text-white text-sm font-semibold px-4 py-2 rounded-[10px] whitespace-nowrap"
            style={{ background: 'var(--accent)' }}>
            + New Lead
          </Link>
        </div>
      </div>

      {/* ── Cold Lead Alert ── */}
      {!loading && coldLeads.length > 0 && (
        <div className="mb-5 rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span>🔥</span>
            <p className="text-sm font-semibold" style={{ color: '#f87171' }}>
              {coldLeads.length} lead{coldLeads.length !== 1 ? 's' : ''} going cold
            </p>
          </div>
          <div className="space-y-1.5">
            {coldLeads.slice(0, 5).map(l => {
              const days = Math.floor((now - new Date(l.updated_at).getTime()) / 86400000)
              const heat = days >= 14 ? { color: '#ef4444', label: 'Very cold' } : days >= 7 ? { color: '#f97316', label: 'Cold' } : { color: '#eab308', label: 'Warm' }
              return (
                <Link key={l.id} href={`/leads/${l.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg transition-colors"
                  style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = heat.color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="badge" style={{ background: `${heat.color}20`, color: heat.color }}>{heat.label}</span>
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

      {/* ── Year selector ── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-medium mr-1" style={{ color: 'var(--text-muted)' }}>Year:</span>
        {years.map(y => (
          <button key={y} onClick={() => setSelectedYear(y)}
            className="text-xs px-3 py-2.5 rounded-full font-semibold"
            style={selectedYear === y
              ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
              : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
            {y}
          </button>
        ))}
      </div>

      {/* ── Status filter pills (list only) ── */}
      {!loading && view === 'list' && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-full font-medium capitalize"
              style={filterStatus === s
                ? { background: STAGE[s].bg, color: STAGE[s].color, border: `1px solid ${STAGE[s].border}40` }
                : { background: 'transparent', color: 'var(--text-faint)', border: '1px solid var(--card-border)' }}>
              {s}
              <span style={{ opacity: 0.7 }}>{statCounts[s]}</span>
            </button>
          ))}
          {filterStatus !== 'all' && (
            <button onClick={() => setFilterStatus('all')} className="text-xs px-2 py-2.5" style={{ color: 'var(--accent-text)' }}>
              Clear ✕
            </button>
          )}
        </div>
      )}

      {/* ── Search ── */}
      <div className="mb-4">
        <input type="text" placeholder="Search by name, phone, Facebook…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg px-4 py-2.5 text-sm" />
      </div>

      {/* ── Kanban Board ── */}
      {!loading && view === 'kanban' && (
        <>
          {/* Mobile stage tabs */}
          <div className="md:hidden flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            {KANBAN_COLS.map(col => {
              const count = kanbanGroups[col].length
              const s = STAGE[col]
              return (
                <button key={col} onClick={() => setKanbanCol(col)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-semibold shrink-0 capitalize"
                  style={{ background: kanbanCol === col ? s.bg : 'var(--subtle-bg)', border: `1px solid ${kanbanCol === col ? s.border : 'var(--card-border)'}`, color: kanbanCol === col ? s.color : 'var(--text-faint)' }}>
                  {col} <span style={{ opacity: 0.7 }}>{count}</span>
                </button>
              )
            })}
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            {/* Desktop: all columns */}
            <div className="hidden md:flex gap-4 overflow-x-auto pb-6 -mx-1 px-1 items-start">
              {KANBAN_COLS.map(col => {
                const s = STAGE[col]
                return (
                  <div key={col} className="shrink-0 w-64">
                    {/* Column header */}
                    <div className="flex items-center gap-2 mb-2.5 px-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.border }} />
                      <span className="text-xs font-semibold uppercase tracking-wider capitalize" style={{ color: s.color }}>{col}</span>
                      <span className="text-xs font-semibold ml-auto tabular px-2 py-0.5 rounded-full"
                        style={{ background: s.bg, color: s.color }}>{kanbanGroups[col].length}</span>
                    </div>
                    <Droppable droppableId={col}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}
                          className="min-h-20 rounded-xl p-2 space-y-2 transition-colors"
                          style={{ background: snapshot.isDraggingOver ? s.bg : 'var(--subtle-bg)', border: `1px solid ${snapshot.isDraggingOver ? s.border + '60' : 'var(--card-border)'}` }}>
                          {kanbanGroups[col].map((lead, i) => {
                            const action = getNextAction(lead)
                            return (
                              <Draggable key={lead.id} draggableId={lead.id} index={i}>
                                {(prov, snap) => (
                                  <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}
                                    className="rounded-xl p-3 cursor-grab active:cursor-grabbing"
                                    style={{
                                      background: snap.isDragging ? 'var(--card-elevated)' : 'var(--card)',
                                      border: `1px solid ${snap.isDragging ? s.border + '60' : 'var(--card-border)'}`,
                                      boxShadow: snap.isDragging ? '0 12px 32px rgba(0,0,0,0.4)' : 'var(--card-inset)',
                                      ...prov.draggableProps.style,
                                    }}>
                                    {/* Card top row */}
                                    <div className="flex items-start gap-2.5 mb-2">
                                      <Avatar name={lead.name} status={lead.status} size={32} />
                                      <div className="flex-1 min-w-0">
                                        <Link href={`/leads/${lead.id}`} onClick={e => e.stopPropagation()}>
                                          <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--text-heading)' }}>{lead.name}</p>
                                        </Link>
                                        {lead.event_type && (
                                          <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            {lead.event_type.replace('_', ' ')}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {/* Card details */}
                                    <div className="space-y-0.5 mb-2">
                                      {lead.event_date && (
                                        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                                          📅 {fmtShort(lead.event_date)}
                                        </p>
                                      )}
                                      {lead.package && (
                                        <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                                          {lead.package}
                                        </p>
                                      )}
                                      {!lead.package && lead.budget && (
                                        <p className="text-xs tabular" style={{ color: 'var(--text-faint)' }}>
                                          ₱{lead.budget.toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                    {/* Action badge */}
                                    {action && (
                                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: action.bg, color: action.color }}>
                                        {action.label}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                          {kanbanGroups[col].length === 0 && (
                            <p className="text-xs text-center py-6" style={{ color: 'var(--text-faint)' }}>Drop here</p>
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
                const action = getNextAction(lead)
                const s = STAGE[kanbanCol]
                return (
                  <div key={lead.id} className="rounded-xl p-4"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderLeft: `3px solid ${s.border}` }}>
                    <div className="flex items-start gap-3 mb-2">
                      <Avatar name={lead.name} status={lead.status} size={36} />
                      <div className="flex-1 min-w-0">
                        <Link href={`/leads/${lead.id}`}>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{lead.name}</p>
                        </Link>
                        <div className="flex gap-2 mt-0.5 text-xs flex-wrap" style={{ color: 'var(--text-faint)' }}>
                          {lead.event_type && <span className="capitalize">{lead.event_type.replace('_', ' ')}</span>}
                          {lead.event_date && <span>📅 {fmtShort(lead.event_date)}</span>}
                          {lead.package && <span>{lead.package}</span>}
                        </div>
                      </div>
                    </div>
                    {action && (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2"
                        style={{ background: action.bg, color: action.color }}>
                        {action.label}
                      </span>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {KANBAN_COLS.filter(c => c !== kanbanCol).map(c => (
                        <button key={c} onClick={() => onDragEnd({ draggableId: lead.id, destination: { droppableId: c, index: 0 }, source: { droppableId: kanbanCol, index: i }, type: 'DEFAULT', mode: 'FLUID', reason: 'DROP', combine: null })}
                          className="text-xs px-2.5 py-1 rounded-lg capitalize"
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
        </>
      )}

      {/* ── List View ── */}
      {(!loading && view === 'kanban') ? null : loading ? (
        <div className="card overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
              <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-4 w-36" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton h-4 w-20 hidden md:block" />
              <div className="skeleton h-4 w-16 hidden md:block" />
              <div className="skeleton h-5 w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="text-4xl mb-3">📋</div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>
            {yearLeads.length === 0 ? `No leads for ${selectedYear} yet.` : 'No leads match your search.'}
          </p>
          {leads.length === 0 && (
            <>
              <p className="text-sm mb-5" style={{ color: 'var(--text-faint)' }}>
                Got a Messenger DM? Paste it — Crafty will extract the details and create the lead instantly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: { prompt: 'Parse this client inquiry and create a lead: ', mode: 'crm' } }))}
                  className="px-5 py-2.5 rounded-[10px] text-sm font-semibold text-white"
                  style={{ background: 'var(--accent)' }}>
                  📋 Paste a Messenger Inquiry
                </button>
                <Link href="/leads/new" className="px-5 py-2.5 rounded-[10px] text-sm font-medium"
                  style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                  + Add manually
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop list */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left pl-5 pr-3">Lead</th>
                  <th className="text-left">Event</th>
                  <th className="text-left">Date</th>
                  <th className="text-left">Source</th>
                  <th className="text-left pr-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const action = getNextAction(lead)
                  const s = STAGE[lead.status]
                  return (
                    <tr key={lead.id} style={{ borderLeft: `3px solid ${s.border}` }}>
                      <td className="pl-4 pr-3 py-4">
                        <Link href={`/leads/${lead.id}`} className="flex items-start gap-3 group">
                          <Avatar name={lead.name} status={lead.status} size={36} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate group-hover:underline" style={{ color: 'var(--text-heading)' }}>
                              {lead.name}
                            </p>
                            {lead.phone && <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{lead.phone}</p>}
                            {action && (
                              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: action.bg, color: action.color }}>
                                {action.label}
                              </span>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="py-4">
                        <p className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
                          {lead.event_type?.replace('_', ' ') ?? '—'}
                        </p>
                        {lead.package && (
                          <p className="text-xs mt-0.5 truncate max-w-[160px]" style={{ color: 'var(--text-faint)' }}>
                            {lead.package}
                          </p>
                        )}
                      </td>
                      <td className="py-4">
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {lead.event_date ? fmtShort(lead.event_date) : '—'}
                        </p>
                      </td>
                      <td className="py-3 capitalize">
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{lead.source}</p>
                      </td>
                      <td className="py-3 pr-5">
                        <span className="badge capitalize" style={{ background: s.bg, color: s.color }}>
                          {lead.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-secondary)' }}>
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                {filtered.length} lead{filtered.length !== 1 ? 's' : ''} shown
              </p>
            </div>
          </div>

          {/* Mobile cards — swipeable */}
          <div className="md:hidden space-y-2">
            {filtered.map(lead => (
              <SwipeCard key={lead.id} lead={lead} onAction={handleSwipeAction} />
            ))}
            <p className="text-xs text-center pt-1" style={{ color: 'var(--text-faint)' }}>
              {filtered.length} lead{filtered.length !== 1 ? 's' : ''} · swipe → to follow up · swipe ← to archive
            </p>
          </div>
        </>
      )}

      {/* ── Swipe undo snackbar ── */}
      {undoInfo && (
        <div className="md:hidden fixed bottom-24 left-4 right-4 z-50 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-2xl"
          style={{ background: '#1e1e30', border: '1px solid rgba(99,102,241,0.4)' }}>
          <p className="text-sm text-white">Moved <strong>{undoInfo.name}</strong></p>
          <button onClick={handleUndo} className="text-sm font-bold ml-4" style={{ color: '#818cf8' }}>Undo</button>
        </div>
      )}
    </div>
  )
}

// ── Swipeable mobile lead card ─────────────────────────────────
function SwipeCard({ lead, onAction }: {
  lead: Lead
  onAction: (id: string, newStatus: LeadStatus, prevStatus: LeadStatus, name: string) => void
}) {
  const startXRef = useRef(0)
  const didSwipeRef = useRef(false)
  const [dx, setDx] = useState(0)
  const [settling, setSettling] = useState(false)
  const THRESHOLD = 80
  const s = STAGE[lead.status]
  const action = getNextAction(lead)

  function onTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX
    didSwipeRef.current = false
  }
  function onTouchMove(e: React.TouchEvent) {
    const d = e.touches[0].clientX - startXRef.current
    setDx(d)
    if (Math.abs(d) > 8) didSwipeRef.current = true
  }
  function onTouchEnd() {
    if (dx > THRESHOLD) onAction(lead.id, 'contacted', lead.status, lead.name)
    else if (dx < -THRESHOLD) onAction(lead.id, 'lost', lead.status, lead.name)
    setSettling(true)
    setDx(0)
    setTimeout(() => setSettling(false), 200)
  }

  const clamped = Math.max(-120, Math.min(120, dx))

  return (
    <div className="relative overflow-hidden" style={{ borderRadius: 14, borderLeft: `3px solid ${s.border}` }}>
      {dx > 20 && (
        <div className="absolute inset-0 flex items-center pl-5" style={{ background: 'rgba(99,102,241,0.12)' }}>
          <span className="text-sm font-semibold" style={{ color: '#818cf8' }}>✓ Mark contacted</span>
        </div>
      )}
      {dx < -20 && (
        <div className="absolute inset-0 flex items-center justify-end pr-5" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <span className="text-sm font-semibold" style={{ color: '#f87171' }}>Archive ×</span>
        </div>
      )}
      <Link
        href={`/leads/${lead.id}`}
        className="relative flex items-start gap-3 card px-4 py-5"
        style={{
          borderRadius: 0,
          borderLeft: 'none',
          display: 'flex',
          transform: `translateX(${clamped}px)`,
          transition: settling ? 'transform 200ms ease' : 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={e => { if (didSwipeRef.current) e.preventDefault() }}
      >
        <Avatar name={lead.name} status={lead.status} size={38} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>{lead.name}</p>
            <span className="badge capitalize shrink-0" style={{ background: s.bg, color: s.color }}>{lead.status}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs flex-wrap" style={{ color: 'var(--text-faint)' }}>
            {lead.event_type && <span className="capitalize">{lead.event_type.replace('_', ' ')}</span>}
            {lead.event_date && <span>· {fmtShort(lead.event_date)}</span>}
            {lead.package && <span>· {lead.package}</span>}
          </div>
          {action && (
            <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: action.bg, color: action.color }}>
              {action.label}
            </span>
          )}
        </div>
      </Link>
    </div>
  )
}
