'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WelcomeCard from '@/components/WelcomeCard'
import { auth, getDocsByUser } from '@/lib/firebase'
import type { LeadStatus } from '@/types'
import TopBar from '@/components/TopBar'

interface ConvoLead {
  id: string
  name: string
  status: LeadStatus
  event_type: string | null
  event_date: string | null
  messenger_sender_id: string
  lastMessage: string | null
  lastRole: string | null
  lastAt: string | null
}

const STAGE: Record<LeadStatus, { color: string; bg: string }> = {
  new:         { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  contacted:   { color: '#fbbf24', bg: 'rgba(234,179,8,0.12)' },
  quoted:      { color: '#fb923c', bg: 'rgba(249,115,22,0.12)' },
  negotiating: { color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
  booked:      { color: '#34d399', bg: 'rgba(16,185,129,0.12)' },
  lost:        { color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
  completed:   { color: '#9ca3af', bg: 'rgba(107,114,128,0.12)' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function InboxPage() {
  const [leads, setLeads] = useState<ConvoLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const user = auth.currentUser
      if (!user) { setLoading(false); return }
      const [allLeads, allMsgs] = await Promise.all([
        getDocsByUser<{ id: string; name: string; status: LeadStatus; event_type: string | null; event_date: string | null; messenger_sender_id: string | null }>('leads', user.uid),
        getDocsByUser<{ sender_id: string; content: string; role: string; created_at: string }>('messenger_conversations', user.uid),
      ])

      const messengerLeads = allLeads.filter(l => l.messenger_sender_id)
      if (!messengerLeads.length) { setLoading(false); return }

      const enriched = messengerLeads.map(lead => {
        const msgs = allMsgs
          .filter(m => m.sender_id === lead.messenger_sender_id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const last = msgs[0]
        return {
          ...lead,
          lastMessage: last?.content ?? null,
          lastRole: last?.role ?? null,
          lastAt: last?.created_at ?? null,
        } as ConvoLead
      })

      enriched.sort((a, b) =>
        new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime()
      )

      setLeads(enriched)
      setLoading(false)
    }
    load()
  }, [])

  const needsReply = leads.filter(l => l.lastRole === 'user')
  const handled = leads.filter(l => l.lastRole !== 'user')

  if (loading) return (
    <div className="p-4 md:p-8 space-y-3">
      <div className="skeleton h-8 w-48 mb-2" />
      {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
    </div>
  )

  return (
    <>
      <TopBar page="Inbox" title="Messenger" subtitle={`${leads.length} conversation${leads.length !== 1 ? 's' : ''}`} />
      <div className="p-4 md:p-8">

      <WelcomeCard
        storageKey="welcome-inbox"
        icon="💬"
        title="Your client messages in one place"
        description="Connect your Facebook page to read and reply to client DMs directly from Crafty CRM — no more switching tabs."
        tips={[
          'Connect your Facebook Business page to receive messages here automatically',
          'Use Crafty AI to draft a reply based on the client inquiry in seconds',
          "Paste any DM into Crafty's 'Do Something' mode to instantly create a lead",
        ]}
        accentColor="#3b82f6"
      />

      {leads.length === 0 ? (
        <div className="card rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">💬</div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>No conversations yet</p>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
            Conversations appear here when clients message your Facebook page and Crafty captures them.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Needs reply */}
          {needsReply.length > 0 && (
            <div>
              <p className="section-label mb-3" style={{ color: 'var(--danger)' }}>
                🔴 Needs a reply — {needsReply.length} lead{needsReply.length !== 1 ? 's' : ''}
              </p>
              <div className="card overflow-hidden">
                {needsReply.map((lead, i) => (
                  <ConvoRow key={lead.id} lead={lead} i={i} />
                ))}
              </div>
            </div>
          )}

          {/* Handled */}
          {handled.length > 0 && (
            <div>
              <p className="section-label mb-3">
                {needsReply.length > 0 ? '✓ Crafty handled' : '💬 All conversations'}
              </p>
              <div className="card overflow-hidden">
                {handled.map((lead, i) => (
                  <ConvoRow key={lead.id} lead={lead} i={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </>
  )
}

function ConvoRow({ lead, i }: { lead: ConvoLead; i: number }) {
  const s = STAGE[lead.status]
  const clientWaiting = lead.lastRole === 'user'

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="flex items-start gap-3 px-4 py-4 transition-colors"
      style={{
        borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
        borderLeft: `3px solid ${clientWaiting ? 'var(--danger)' : 'transparent'}`,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
        style={{ background: s.bg, color: s.color }}>
        {lead.name[0]?.toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-heading)' }}>
            {lead.name}
          </p>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>
            {lead.lastAt ? timeAgo(lead.lastAt) : '—'}
          </span>
        </div>

        {/* Last message preview */}
        <p className="text-xs truncate mb-1.5"
          style={{ color: clientWaiting ? 'var(--text-secondary)' : 'var(--text-faint)' }}>
          {clientWaiting ? '' : '✓ '}
          {lead.lastMessage
            ? lead.lastMessage.slice(0, 80) + (lead.lastMessage.length > 80 ? '…' : '')
            : 'No messages'}
        </p>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge capitalize" style={{ background: s.bg, color: s.color }}>
            {lead.status}
          </span>
          {lead.event_type && (
            <span className="text-xs capitalize" style={{ color: 'var(--text-faint)' }}>
              {lead.event_type.replace('_', ' ')}
            </span>
          )}
          {lead.event_date && (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              · {new Date(lead.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {clientWaiting && (
            <span className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
              Reply needed →
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
