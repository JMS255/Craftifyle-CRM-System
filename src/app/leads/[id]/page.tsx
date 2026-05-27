'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { Lead, LeadStatus, Activity, ActivityType } from '@/types'

const PIPELINE: LeadStatus[] = [
  'new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost',
]

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  contacted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  quoted: 'bg-orange-100 text-orange-700 border-orange-200',
  negotiating: 'bg-purple-100 text-purple-700 border-purple-200',
  booked: 'bg-green-100 text-green-700 border-green-200',
  lost: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
}

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  note: '📝',
  call: '📞',
  message: '💬',
  follow_up: '🔔',
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface ConversationMessage {
  role: string
  content: string
  created_at: string
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<Lead & { crafty_active?: boolean; messenger_sender_id?: string } | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [conversation, setConversation] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingCrafty, setTogglingCrafty] = useState(false)

  // Activity form
  const [actType, setActType] = useState<ActivityType>('note')
  const [actContent, setActContent] = useState('')
  const [actFollowUp, setActFollowUp] = useState('')
  const [addingActivity, setAddingActivity] = useState(false)

  // Convert to booking form
  const [converting, setConverting] = useState(false)
  const [bookForm, setBookForm] = useState({
    event_name: '',
    event_time: '',
    package_name: '',
    package_price: '',
    deposit_amount: '',
  })

  const db = createClient()

  async function reload() {
    const [{ data: l }, { data: a }] = await Promise.all([
      db.from('leads').select('*').eq('id', id).single(),
      db.from('activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ])
    setLead(l)
    setActivities(a ?? [])
    if (l?.messenger_sender_id) {
      const { data: msgs } = await db
        .from('messenger_conversations')
        .select('role, content, created_at')
        .eq('sender_id', l.messenger_sender_id)
        .order('created_at', { ascending: true })
        .limit(50)
      setConversation(msgs ?? [])
    }
    setLoading(false)
  }

  async function toggleCrafty() {
    if (!lead) return
    setTogglingCrafty(true)
    const newVal = !(lead.crafty_active ?? true)
    await db.from('leads').update({ crafty_active: newVal }).eq('id', id)
    setLead((prev) => prev ? { ...prev, crafty_active: newVal } : prev)
    setTogglingCrafty(false)
  }

  useEffect(() => { reload() }, [id])

  async function updateStatus(status: LeadStatus) {
    setSaving(true)
    await db.from('leads').update({ status }).eq('id', id)
    setSaving(false)
    setLead((prev) => prev ? { ...prev, status } : prev)
  }

  async function addActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!actContent.trim()) return
    setAddingActivity(true)
    const { data: { user } } = await db.auth.getUser()
    await db.from('activities').insert({
      lead_id: id,
      type: actType,
      content: actContent.trim(),
      follow_up_date: actFollowUp || null,
      completed: false,
      user_id: user?.id,
    })
    setActContent('')
    setActFollowUp('')
    setAddingActivity(false)
    reload()
  }

  async function markActivityDone(actId: string) {
    await db.from('activities').update({ completed: true }).eq('id', actId)
    setActivities((prev) => prev.map((a) => a.id === actId ? { ...a, completed: true } : a))
  }

  async function convertToBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!bookForm.event_name.trim()) return
    setConverting(true)
    const { data: { user } } = await db.auth.getUser()
    const { data: booking } = await db
      .from('bookings')
      .insert({
        lead_id: id,
        event_name: bookForm.event_name.trim(),
        event_date: lead!.event_date,
        event_time: bookForm.event_time || null,
        venue: lead!.venue,
        package_name: bookForm.package_name || null,
        package_price: bookForm.package_price ? parseFloat(bookForm.package_price) : null,
        deposit_amount: bookForm.deposit_amount ? parseFloat(bookForm.deposit_amount) : 0,
        balance_amount: bookForm.package_price && bookForm.deposit_amount
          ? parseFloat(bookForm.package_price) - parseFloat(bookForm.deposit_amount)
          : 0,
        status: 'upcoming',
        user_id: user?.id,
      })
      .select()
      .single()
    await db.from('leads').update({ status: 'booked' }).eq('id', id)
    setConverting(false)
    if (booking) router.push(`/bookings/${booking.id}`)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (!lead) return <div className="p-8 text-red-500 text-sm">Lead not found.</div>

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/leads" className="text-sm text-indigo-600 hover:underline">
          ← Back to Leads
        </Link>
        <div className="flex items-start justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
            <p className="text-gray-400 text-sm mt-1">Added {fmt(lead.created_at)}</p>
          </div>
          <span className={`text-sm px-3 py-1 rounded-full font-medium border ${STATUS_COLORS[lead.status]}`}>
            {lead.status}
          </span>
        </div>
      </div>

      {/* Status Pipeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pipeline Stage</p>
        <div className="flex gap-2 flex-wrap">
          {PIPELINE.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              disabled={saving}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize ${
                lead.status === s
                  ? STATUS_COLORS[s]
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Lead Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Details</p>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Info label="Phone" value={lead.phone} />
          <Info label="Email" value={lead.email} />
          <Info label="Facebook" value={lead.facebook} />
          <Info label="Source" value={lead.source} />
          <Info label="Event Type" value={lead.event_type?.replace('_', ' ')} />
          <Info label="Event Date" value={lead.event_date ? fmt(lead.event_date) : null} />
          <Info label="Venue" value={lead.venue} />
          <Info label="Guests" value={lead.guest_count?.toString()} />
          <Info label="Package" value={lead.package} />
          <Info label="Budget" value={lead.budget ? `₱${lead.budget.toLocaleString()}` : null} />
          {lead.notes && (
            <div className="col-span-2">
              <dt className="text-gray-400 text-xs mb-1">Notes</dt>
              <dd className="text-gray-700 whitespace-pre-line">{lead.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Crafty Takeover Toggle */}
      {lead.messenger_sender_id && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Crafty AI</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {lead.crafty_active !== false
                ? 'Crafty is handling this conversation automatically.'
                : 'You are handling this — Crafty is silent.'}
            </p>
          </div>
          <button
            onClick={toggleCrafty}
            disabled={togglingCrafty}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
              lead.crafty_active !== false ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                lead.crafty_active !== false ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      )}

      {/* Messenger Conversation Viewer */}
      {conversation.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            💬 Messenger Conversation
          </p>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {conversation.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    : 'bg-indigo-600 text-white rounded-tr-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-gray-400' : 'text-indigo-200'}`}>
                    {msg.role === 'user' ? lead.name?.split(' ')[0] : 'Crafty'} · {timeAgo(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Reply */}
      <AiReply lead={lead} />

      {/* Convert to Booking */}
      {lead.status !== 'booked' && lead.status !== 'completed' && lead.status !== 'lost' && (
        <details className="bg-green-50 border border-green-200 rounded-xl p-5 mb-5">
          <summary className="cursor-pointer text-sm font-semibold text-green-800">
            Convert to Booking
          </summary>
          <form onSubmit={convertToBooking} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bookForm.event_name}
                  onChange={(e) => setBookForm((p) => ({ ...p, event_name: e.target.value }))}
                  placeholder={`${lead.name}'s ${lead.event_type ?? 'Event'}`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <BookField label="Event Time" value={bookForm.event_time} onChange={(v) => setBookForm((p) => ({ ...p, event_time: v }))} type="time" />
              <BookField label="Package Name" value={bookForm.package_name} onChange={(v) => setBookForm((p) => ({ ...p, package_name: v }))} placeholder="Premium 3 Hours" />
              <BookField label="Package Price (₱)" value={bookForm.package_price} onChange={(v) => setBookForm((p) => ({ ...p, package_price: v }))} type="number" placeholder="15000" />
              <BookField label="Deposit (₱)" value={bookForm.deposit_amount} onChange={(v) => setBookForm((p) => ({ ...p, deposit_amount: v }))} type="number" placeholder="5000" />
            </div>
            <button
              type="submit"
              disabled={converting}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {converting ? 'Creating…' : 'Confirm Booking →'}
            </button>
          </form>
        </details>
      )}

      {/* Activities */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Activity Log</p>

        {/* Add activity */}
        <form onSubmit={addActivity} className="mb-5 bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex gap-2">
            {(['note', 'call', 'message', 'follow_up'] as ActivityType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActType(t)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize ${
                  actType === t
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {ACTIVITY_ICONS[t]} {t.replace('_', ' ')}
              </button>
            ))}
          </div>
          <textarea
            value={actContent}
            onChange={(e) => setActContent(e.target.value)}
            rows={2}
            placeholder={actType === 'follow_up' ? 'What needs to be followed up?' : 'Add a note…'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          {actType === 'follow_up' && (
            <input
              type="date"
              value={actFollowUp}
              onChange={(e) => setActFollowUp(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          <button
            type="submit"
            disabled={addingActivity || !actContent.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {addingActivity ? 'Saving…' : 'Add'}
          </button>
        </form>

        {/* Timeline */}
        {activities.length === 0 ? (
          <p className="text-gray-400 text-sm">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className={`flex gap-3 ${a.completed ? 'opacity-50' : ''}`}>
                <span className="text-lg leading-none mt-0.5">{ACTIVITY_ICONS[a.type]}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{a.content}</p>
                  {a.follow_up_date && (
                    <p className="text-xs text-orange-500 mt-0.5">
                      Follow up: {fmt(a.follow_up_date)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(a.created_at)}</p>
                </div>
                {a.type === 'follow_up' && !a.completed && (
                  <button
                    onClick={() => markActivityDone(a.id)}
                    className="text-xs text-green-600 hover:underline self-start"
                  >
                    Done
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
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
    setLoading(true)
    setError('')
    setReply('')
    setCopied(false)
    const res = await fetch('/api/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientMessage: clientMsg,
        leadContext: {
          name: lead.name,
          event_type: lead.event_type,
          event_date: lead.event_date,
          venue: lead.venue,
          guest_count: lead.guest_count,
          package: lead.package,
          budget: lead.budget,
        },
      }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setReply(data.reply)
    }
    setLoading(false)
  }

  function copy() {
    navigator.clipboard.writeText(reply)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">🤖</span>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">AI Reply Draft</p>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Paste what the client sent you on Facebook or Instagram — get a ready-to-send reply.
      </p>

      <textarea
        value={clientMsg}
        onChange={(e) => setClientMsg(e.target.value)}
        rows={3}
        placeholder={`Paste the client's message here…\ne.g. "Hi! Magkano ang photobooth for 100 pax wedding?"`}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-3"
      />

      <button
        onClick={generate}
        disabled={loading || !clientMsg.trim()}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? 'Writing reply…' : 'Generate Reply'}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {reply && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Suggested Reply</p>
            <button
              onClick={copy}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap">
            {reply}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Review before sending — edit anything that doesn&apos;t sound like you.
          </p>
          <button
            onClick={() => { setReply(''); setClientMsg('') }}
            className="text-xs text-gray-400 hover:text-gray-600 mt-1"
          >
            Clear and start over
          </button>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-gray-800 font-medium capitalize">{value}</dd>
    </div>
  )
}

function BookField({
  label, value, onChange, type = 'text', placeholder = '',
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  )
}
