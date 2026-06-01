'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import PackagePicker from '@/components/PackagePicker'
import type { Lead, LeadStatus, Activity, ActivityType } from '@/types'

const PIPELINE: LeadStatus[] = ['new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost']

const STAGE: Record<LeadStatus, { color: string; bg: string; border: string }> = {
  new:         { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
  contacted:   { color: '#fbbf24', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)' },
  quoted:      { color: '#fb923c', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
  negotiating: { color: '#a78bfa', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)' },
  booked:      { color: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  lost:        { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  completed:   { color: '#9ca3af', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
}

const ACT_ICON: Record<ActivityType, string> = {
  note: '📝', call: '📞', message: '💬', follow_up: '🔔',
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface ConvoMsg { role: string; content: string; created_at: string }

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<Lead & { crafty_active?: boolean; messenger_sender_id?: string } | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [conversation, setConversation] = useState<ConvoMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingCrafty, setTogglingCrafty] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Lead>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [actType, setActType] = useState<ActivityType>('note')
  const [actContent, setActContent] = useState('')
  const [actFollowUp, setActFollowUp] = useState('')
  const [addingActivity, setAddingActivity] = useState(false)
  const [converting, setConverting] = useState(false)
  const [bookForm, setBookForm] = useState({ event_name: '', event_time: '', package_name: '', package_price: '', deposit_amount: '' })
  const [showConvert, setShowConvert] = useState(false)

  const db = createClient()

  function startEdit() {
    if (!lead) return
    setEditForm({ name: lead.name, phone: lead.phone, email: lead.email, facebook: lead.facebook, source: lead.source, event_type: lead.event_type, event_date: lead.event_date, venue: lead.venue, guest_count: lead.guest_count, package: lead.package, budget: lead.budget, notes: lead.notes })
    setEditing(true)
  }
  async function saveEdit() {
    setSavingEdit(true)
    await db.from('leads').update(editForm).eq('id', id)
    setSavingEdit(false)
    setEditing(false)
    reload()
  }
  async function reload() {
    const [{ data: l }, { data: a }] = await Promise.all([
      db.from('leads').select('*').eq('id', id).single(),
      db.from('activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ])
    setLead(l)
    setActivities(a ?? [])
    if (l?.messenger_sender_id) {
      const { data: msgs } = await db.from('messenger_conversations').select('role, content, created_at')
        .eq('sender_id', l.messenger_sender_id).order('created_at', { ascending: true }).limit(50)
      setConversation(msgs ?? [])
    }
    setLoading(false)
  }
  async function toggleCrafty() {
    if (!lead) return
    setTogglingCrafty(true)
    const newVal = !(lead.crafty_active ?? true)
    await db.from('leads').update({ crafty_active: newVal }).eq('id', id)
    setLead(prev => prev ? { ...prev, crafty_active: newVal } : prev)
    setTogglingCrafty(false)
  }
  useEffect(() => { reload() }, [id])

  async function updateStatus(status: LeadStatus) {
    setSaving(true)
    await db.from('leads').update({ status }).eq('id', id)
    setSaving(false)
    setLead(prev => prev ? { ...prev, status } : prev)
  }
  async function addActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!actContent.trim()) return
    setAddingActivity(true)
    const { data: { user } } = await db.auth.getUser()
    await db.from('activities').insert({ lead_id: id, type: actType, content: actContent.trim(), follow_up_date: actFollowUp || null, completed: false, user_id: user?.id })
    setActContent(''); setActFollowUp(''); setAddingActivity(false); reload()
  }
  async function markActivityDone(actId: string) {
    await db.from('activities').update({ completed: true }).eq('id', actId)
    setActivities(prev => prev.map(a => a.id === actId ? { ...a, completed: true } : a))
  }
  async function convertToBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!bookForm.event_name.trim()) return
    setConverting(true)
    const { data: { user } } = await db.auth.getUser()
    const { data: booking } = await db.from('bookings').insert({
      lead_id: id, event_name: bookForm.event_name.trim(), event_date: lead!.event_date,
      event_time: bookForm.event_time || null, venue: lead!.venue,
      package_name: bookForm.package_name || null,
      package_price: bookForm.package_price ? parseFloat(bookForm.package_price) : null,
      deposit_amount: bookForm.deposit_amount ? parseFloat(bookForm.deposit_amount) : 0,
      balance_amount: bookForm.package_price && bookForm.deposit_amount ? parseFloat(bookForm.package_price) - parseFloat(bookForm.deposit_amount) : 0,
      status: 'upcoming', user_id: user?.id,
    }).select().single()
    await db.from('leads').update({ status: 'booked' }).eq('id', id)
    setConverting(false)
    if (booking) router.push(`/bookings/${booking.id}`)
  }

  if (loading) return (
    <div className="p-4 md:p-8 max-w-5xl space-y-4">
      <div className="skeleton h-8 w-52" />
      <div className="skeleton h-14 w-full rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-4">
          <div className="card p-6 space-y-3"><div className="skeleton h-5 w-48" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-3/4" /></div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 space-y-3"><div className="skeleton h-5 w-32" /><div className="skeleton h-8 w-full" /></div>
        </div>
      </div>
    </div>
  )
  if (!lead) return <div className="p-8 text-sm" style={{ color: 'var(--danger)' }}>Lead not found.</div>

  const s = STAGE[lead.status]
  const mainStages: LeadStatus[] = ['new', 'contacted', 'quoted', 'negotiating', 'booked']
  const activeIdx = mainStages.indexOf(lead.status as LeadStatus)
  const canConvert = !['booked', 'completed', 'lost'].includes(lead.status)

  return (
    <div className="p-4 md:p-8 max-w-5xl">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/leads" className="text-sm" style={{ color: 'var(--accent-text)' }}>← Leads</Link>
        <span style={{ color: 'var(--text-faint)' }}>/</span>
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }}>{lead.name}</span>
        <div className="ml-auto flex items-center gap-2">
          {!editing ? (
            <button onClick={startEdit} className="text-xs px-3 py-1.5 rounded-[10px] font-medium"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
              Edit
            </button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-[10px]"
                style={{ color: 'var(--text-faint)' }}>Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit} className="text-xs px-3 py-1.5 rounded-[10px] font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Name + status bar ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-heading)' }}>{lead.name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-faint)' }}>Added {fmt(lead.created_at)}</p>
        </div>
        <span className="badge text-xs px-3 py-1 shrink-0 capitalize font-semibold"
          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
          {lead.status}
        </span>
      </div>

      {/* ── Pipeline progress bar ── */}
      <div className="card p-4 mb-5">
        <div className="flex items-center gap-0 overflow-x-auto">
          {mainStages.map((stage, i) => {
            const st = STAGE[stage]
            const isActive = lead.status === stage
            const isPast = activeIdx > i
            const isLost = lead.status === 'lost'
            return (
              <div key={stage} className="flex items-center min-w-0">
                <button onClick={() => updateStatus(stage)} disabled={saving}
                  className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all shrink-0"
                  style={{ opacity: isLost ? 0.4 : 1 }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: isActive ? st.color : isPast ? 'var(--success)' : 'var(--subtle-bg)',
                      color: isActive || isPast ? '#fff' : 'var(--text-faint)',
                      border: isActive ? `2px solid ${st.color}` : isPast ? '2px solid var(--success)' : '2px solid var(--card-border)',
                    }}>
                    {isPast ? '✓' : i + 1}
                  </div>
                  <span className="text-[10px] font-medium capitalize whitespace-nowrap"
                    style={{ color: isActive ? st.color : isPast ? 'var(--success)' : 'var(--text-faint)' }}>
                    {stage}
                  </span>
                </button>
                {i < mainStages.length - 1 && (
                  <div className="flex-1 h-px mx-1 min-w-4"
                    style={{ background: isPast ? 'var(--success)' : 'var(--border-secondary)' }} />
                )}
              </div>
            )
          })}
          {/* Lost exit button */}
          <div className="flex items-center ml-3 pl-3" style={{ borderLeft: '1px solid var(--border-secondary)' }}>
            <button onClick={() => updateStatus('lost')} disabled={saving}
              className="text-[10px] px-2.5 py-1.5 rounded-lg font-medium capitalize"
              style={lead.status === 'lost'
                ? { background: STAGE.lost.bg, color: STAGE.lost.color, border: `1px solid ${STAGE.lost.border}` }
                : { background: 'transparent', color: 'var(--text-faint)', border: '1px solid var(--card-border)' }}>
              ✕ lost
            </button>
          </div>
        </div>
      </div>

      {/* ── 2-column layout ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Left col — info + messenger */}
        <div className="md:col-span-2 space-y-5">

          {/* Client Info */}
          <div className="card p-5">
            <p className="section-label mb-4">Client Details</p>
            {!editing ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <InfoRow label="Phone" value={lead.phone} />
                <InfoRow label="Email" value={lead.email} />
                <InfoRow label="Facebook" value={lead.facebook} />
                <InfoRow label="Source" value={lead.source} />
                <InfoRow label="Event Type" value={lead.event_type?.replace('_', ' ')} />
                <InfoRow label="Event Date" value={lead.event_date ? fmt(lead.event_date) : null} />
                <InfoRow label="Venue" value={lead.venue} />
                <InfoRow label="Guests" value={lead.guest_count?.toString()} />
                <InfoRow label="Package" value={lead.package} />
                <InfoRow label="Budget" value={lead.budget ? `₱${lead.budget.toLocaleString()}` : null} />
                {lead.notes && (
                  <div className="col-span-2">
                    <p className="section-label mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{lead.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Name', key: 'name', type: 'text' },
                  { label: 'Phone', key: 'phone', type: 'text' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Facebook', key: 'facebook', type: 'text' },
                  { label: 'Venue', key: 'venue', type: 'text' },
                  { label: 'Package', key: 'package', type: 'text' },
                  { label: 'Budget (₱)', key: 'budget', type: 'number' },
                  { label: 'Guests', key: 'guest_count', type: 'number' },
                  { label: 'Event Date', key: 'event_date', type: 'date' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
                    <input type={type} value={(editForm as Record<string, unknown>)[key] as string ?? ''}
                      onChange={e => setEditForm(p => ({ ...p, [key]: type === 'number' ? (e.target.value ? parseFloat(e.target.value) : null) : e.target.value || null }))}
                      className="w-full rounded-lg px-3 py-2 text-sm" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                  <textarea rows={3} value={editForm.notes ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, notes: e.target.value || null }))}
                    className="w-full rounded-lg px-3 py-2 text-sm resize-none" />
                </div>
              </div>
            )}
          </div>

          {/* Messenger Conversation */}
          {conversation.length > 0 && (
            <div className="card p-5">
              <p className="section-label mb-4">💬 Messenger Conversation</p>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {conversation.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm"
                      style={msg.role === 'user'
                        ? { background: 'var(--card-elevated)', color: 'var(--text-heading)', borderRadius: '18px 18px 18px 4px' }
                        : { background: 'var(--accent)', color: '#fff', borderRadius: '18px 18px 4px 18px' }}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <p className="text-xs mt-1 opacity-60">
                        {msg.role === 'user' ? lead.name?.split(' ')[0] : 'Crafty'} · {timeAgo(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Log */}
          <div className="card p-5">
            <p className="section-label mb-4">Activity Log</p>

            {/* Add activity form */}
            <form onSubmit={addActivity} className="mb-6 rounded-xl p-4 space-y-3"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex gap-1.5 flex-wrap">
                {(['note', 'call', 'message', 'follow_up'] as ActivityType[]).map(t => (
                  <button key={t} type="button" onClick={() => setActType(t)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium capitalize"
                    style={actType === t
                      ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
                      : { background: 'transparent', color: 'var(--text-faint)', border: '1px solid var(--card-border)' }}>
                    {ACT_ICON[t]} {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <textarea value={actContent} onChange={e => setActContent(e.target.value)} rows={2}
                placeholder={actType === 'follow_up' ? 'What needs to be followed up?' : 'Add a note…'}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none" />
              {actType === 'follow_up' && (
                <input type="date" value={actFollowUp} onChange={e => setActFollowUp(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm" />
              )}
              <button type="submit" disabled={addingActivity || !actContent.trim()}
                className="text-xs px-4 py-2 rounded-[10px] font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                {addingActivity ? 'Saving…' : 'Add'}
              </button>
            </form>

            {/* Timeline */}
            {activities.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No activity yet.</p>
            ) : (
              <div className="space-y-0">
                {activities.map((a, i) => (
                  <div key={a.id} className="flex gap-3 relative"
                    style={{ opacity: a.completed ? 0.45 : 1, paddingBottom: i < activities.length - 1 ? '1.25rem' : 0 }}>
                    {/* Timeline line */}
                    {i < activities.length - 1 && (
                      <div className="absolute left-[17px] top-8 bottom-0 w-px"
                        style={{ background: 'var(--border-secondary)' }} />
                    )}
                    {/* Icon circle */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 relative z-10"
                      style={{ background: 'var(--card-elevated)', border: '1px solid var(--card-border)' }}>
                      {ACT_ICON[a.type]}
                    </div>
                    <div className="flex-1 pt-1.5 min-w-0">
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-heading)' }}>{a.content}</p>
                      {a.follow_up_date && (
                        <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--warning)' }}>
                          Follow up: {fmt(a.follow_up_date)}
                        </p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{timeAgo(a.created_at)}</p>
                    </div>
                    {a.type === 'follow_up' && !a.completed && (
                      <button onClick={() => markActivityDone(a.id)}
                        className="text-xs shrink-0 pt-1.5 font-medium" style={{ color: 'var(--success)' }}>
                        Done ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right col — actions */}
        <div className="space-y-4">

          {/* Convert to Booking */}
          {canConvert && (
            <div className="card overflow-hidden">
              <button onClick={() => setShowConvert(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4"
                style={{ borderBottom: showConvert ? '1px solid var(--card-border)' : 'none' }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">🎉</span>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Convert to Booking</p>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{showConvert ? '▲' : '▼'}</span>
              </button>
              {showConvert && (
                <form onSubmit={convertToBooking} className="px-5 pb-5 space-y-3 pt-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      Event Name <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input type="text" required value={bookForm.event_name}
                      onChange={e => setBookForm(p => ({ ...p, event_name: e.target.value }))}
                      placeholder={`${lead.name}'s ${lead.event_type ?? 'Event'}`}
                      className="w-full rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Event Time</label>
                    <input type="time" value={bookForm.event_time}
                      onChange={e => setBookForm(p => ({ ...p, event_time: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <PackagePicker
                    value={{ packageName: bookForm.package_name, packagePrice: bookForm.package_price ? parseFloat(bookForm.package_price) : 0 }}
                    onChange={({ packageName, packagePrice }) => setBookForm(p => ({ ...p, package_name: packageName, package_price: String(packagePrice) }))}
                    onDepositSuggest={deposit => setBookForm(p => ({ ...p, deposit_amount: String(deposit) }))}
                  />
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Deposit (₱)</label>
                    <input type="number" value={bookForm.deposit_amount}
                      onChange={e => setBookForm(p => ({ ...p, deposit_amount: e.target.value }))}
                      placeholder="1000" className="w-full rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <button type="submit" disabled={converting}
                    className="w-full py-2.5 rounded-[10px] text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'var(--success)' }}>
                    {converting ? 'Creating…' : 'Confirm Booking →'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Follow-up Templates */}
          <FollowUpTemplates lead={lead} />

          {/* Crafty Toggle */}
          {lead.messenger_sender_id && (
            <div className="card p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Crafty AI</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {lead.crafty_active !== false ? 'Auto-handling this lead' : 'You have taken over'}
                </p>
              </div>
              <button onClick={toggleCrafty} disabled={togglingCrafty}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
                style={{ background: lead.crafty_active !== false ? 'var(--accent)' : 'var(--subtle-bg)' }}>
                <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  style={{ transform: lead.crafty_active !== false ? 'translateX(22px)' : 'translateX(4px)' }} />
              </button>
            </div>
          )}

          {/* AI Reply Draft */}
          <AiReply lead={lead} />
        </div>
      </div>
    </div>
  )
}

function FollowUpTemplates({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const firstName = lead.name.split(' ')[0]
  const eventStr = lead.event_date
    ? new Date(lead.event_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })
    : 'your event'
  const templates = [
    { id: 'gentle', label: 'Gentle check-in', text: `Hi ${firstName}! 😊 Just checking in — interested pa po ba sa aming serbisyo para sa ${eventStr}? Feel free to ask kung may questions kayo! 📸` },
    { id: 'slot',   label: 'Slot urgency',    text: `Hi ${firstName}! Naghahawak pa kami ng slot for ${eventStr}, pero baka ma-release na namin sa ibang client if walang confirmation. Okay pa ba kayo? 😊` },
    { id: 'final',  label: 'Final follow-up', text: `Hi ${firstName}! Last follow-up na po ito para sa ${eventStr}. If hindi na kayo interested, okay lang — just let us know. Salamat po! 🙏` },
  ]
  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ borderBottom: open ? '1px solid var(--card-border)' : 'none' }}>
        <div className="flex items-center gap-2">
          <span>💬</span>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Follow-up Templates</p>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 pt-3">
          {templates.map(t => (
            <div key={t.id} className="rounded-xl p-3"
              style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)' }}>
              <p className="section-label mb-2">{t.label}</p>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{t.text}</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => copy(t.text, t.id)}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: copied === t.id ? 'var(--success-muted)' : 'var(--accent-subtle)', color: copied === t.id ? 'var(--success)' : 'var(--accent-text)' }}>
                  {copied === t.id ? '✓ Copied!' : 'Copy'}
                </button>
                {lead.facebook && (
                  <a href={`https://m.me/${lead.facebook.replace(/^.*\//, '')}`} target="_blank" rel="noreferrer"
                    className="text-xs px-2.5 py-1 rounded-lg font-medium"
                    style={{ background: 'var(--subtle-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                    Open Messenger →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AiReply({ lead }: { lead: Lead }) {
  const [clientMsg, setClientMsg] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    if (!clientMsg.trim()) return
    setLoading(true); setError(''); setReply(''); setCopied(false)
    const res = await fetch('/api/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMessage: clientMsg, leadContext: { name: lead.name, event_type: lead.event_type, event_date: lead.event_date, venue: lead.venue, guest_count: lead.guest_count, package: lead.package, budget: lead.budget } }),
    })
    const data = await res.json()
    if (data.error) setError(data.error); else setReply(data.reply)
    setLoading(false)
  }
  function copy() { navigator.clipboard.writeText(reply); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span>🤖</span>
        <p className="section-label">AI Reply Draft</p>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-faint)' }}>
        Paste the client's message — get a ready-to-send reply.
      </p>
      <textarea value={clientMsg} onChange={e => setClientMsg(e.target.value)} rows={3}
        placeholder={`e.g. "Magkano ang photobooth for 100 pax?"`}
        className="w-full rounded-lg px-3 py-2 text-sm resize-none mb-3" />
      <button onClick={generate} disabled={loading || !clientMsg.trim()}
        className="text-xs px-4 py-2 rounded-[10px] font-medium text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}>
        {loading ? 'Writing…' : 'Generate Reply'}
      </button>
      {error && <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {reply && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">Suggested Reply</p>
            <button onClick={copy} className="text-xs font-medium" style={{ color: copied ? 'var(--success)' : 'var(--accent-text)' }}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div className="rounded-xl px-4 py-3 text-sm whitespace-pre-wrap"
            style={{ background: 'var(--accent-subtle)', border: '1px solid var(--card-border)', color: 'var(--text-heading)' }}>
            {reply}
          </div>
          <button onClick={() => { setReply(''); setClientMsg('') }}
            className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
            Clear ✕
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="section-label mb-0.5">{label}</p>
      <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-heading)' }}>{value}</p>
    </div>
  )
}
