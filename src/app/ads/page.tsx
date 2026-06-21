'use client'

import { useEffect, useState } from 'react'
import { auth, getDocsByUser, addDocument, updateDocument, deleteDocument } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import type { AdCampaign, AdPlatform, Lead, Booking } from '@/types'

const EMPTY_FORM = { name: '', platform: 'facebook' as AdPlatform, spend: '', start_date: '', end_date: '', notes: '' }

const PLATFORM_LABELS: Record<AdPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  google: 'Google',
}

const PLATFORM_COLORS: Record<AdPlatform, { bg: string; text: string }> = {
  facebook: { bg: '#e7f0ff', text: '#1877f2' },
  instagram: { bg: '#fce7f3', text: '#e1306c' },
  tiktok: { bg: '#f0f0f0', text: '#010101' },
  google: { bg: '#fef3e2', text: '#ea4335' },
}

interface CampaignRow extends AdCampaign {
  leads: number
  booked: number
  revenue: number
  roas: number | null
  cpl: number | null
}

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseReply, setParseReply] = useState('')
  const [parsedForm, setParsedForm] = useState<typeof EMPTY_FORM | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { setLoading(false); return }
      load(user.uid)
    })
    return () => unsub()
  }, [])

  async function load(uid: string) {
    const [rawCampaigns, leads, bookings] = await Promise.all([
      getDocsByUser<AdCampaign>('ad_campaigns', uid),
      getDocsByUser<Lead>('leads', uid),
      getDocsByUser<Booking>('bookings', uid),
    ])

    const bookingMap = new Map<string, number>()
    for (const b of bookings) {
      if (b.lead_id) bookingMap.set(b.lead_id, b.craftifyle_income || b.package_price || 0)
    }

    const rows: CampaignRow[] = rawCampaigns
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(c => {
        const campaignLeads = leads.filter(l => l.ad_campaign_id === c.id)
        const bookedLeads = campaignLeads.filter(l => ['booked', 'completed'].includes(l.status))
        const revenue = bookedLeads.reduce((sum, l) => sum + (bookingMap.get(l.id) ?? 0), 0)
        const roas = c.spend > 0 ? revenue / c.spend : null
        const cpl = c.spend > 0 && campaignLeads.length > 0 ? c.spend / campaignLeads.length : null
        return { ...c, leads: campaignLeads.length, booked: bookedLeads.length, revenue, roas, cpl }
      })

    setCampaigns(rows)
    setLoading(false)
  }

  async function save() {
    if (!form.name.trim() || !form.spend || !form.start_date) return
    const user = auth.currentUser
    if (!user) return
    setSaving(true)
    const now = new Date().toISOString()
    const payload: Omit<AdCampaign, 'id' | 'created_at'> = {
      name: form.name.trim(),
      platform: form.platform,
      spend: parseFloat(form.spend),
      start_date: form.start_date,
      ...(form.end_date ? { end_date: form.end_date } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      status: 'active',
      user_id: user.uid,
      updated_at: now,
    }
    try {
      if (editingId) {
        await updateDocument('ad_campaigns', editingId, payload)
      } else {
        await addDocument('ad_campaigns', { ...payload, created_at: now })
      }
      await load(user.uid)
      setForm(EMPTY_FORM)
      setShowForm(false)
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return
    await deleteDocument('ad_campaigns', id)
    const user = auth.currentUser
    if (user) await load(user.uid)
  }

  function startEdit(c: CampaignRow) {
    setEditingId(c.id)
    setForm({
      name: c.name,
      platform: c.platform,
      spend: String(c.spend),
      start_date: c.start_date,
      end_date: c.end_date ?? '',
      notes: c.notes ?? '',
    })
    setShowForm(true)
    setShowPaste(false)
  }

  async function parseFbData() {
    if (!pasteText.trim()) return
    setParsing(true)
    setParseReply('')
    setParsedForm(null)
    try {
      const res = await fetch('/api/ads-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: pasteText }],
          existing: campaigns.map(c => ({ id: c.id, name: c.name })),
        }),
      })
      const data = await res.json()
      setParseReply(data.reply ?? '')
      if (data.campaign) {
        setParsedForm({
          name: data.campaign.name ?? '',
          platform: data.campaign.platform ?? 'facebook',
          spend: String(data.campaign.spend ?? ''),
          start_date: data.campaign.start_date ?? '',
          end_date: data.campaign.end_date ?? '',
          notes: '',
        })
      }
      const user = auth.currentUser
      if (user) await load(user.uid)
    } finally {
      setParsing(false)
    }
  }

  function applyParsed() {
    if (!parsedForm) return
    setForm(parsedForm)
    setEditingId(null)
    setShowForm(true)
    setShowPaste(false)
    setParsedForm(null)
    setPasteText('')
  }

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0)
  const overallROAS = totalSpend > 0 ? totalRevenue / totalSpend : null
  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0)

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Ad Campaigns</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Log your ad spend, track ROAS and CPL, and attribute leads to campaigns.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Spend" value={`₱${totalSpend.toLocaleString()}`} color="danger" />
        <StatCard label="Ad Revenue" value={`₱${totalRevenue.toLocaleString()}`} color="green" />
        <StatCard
          label="Overall ROAS"
          value={overallROAS !== null ? `${overallROAS.toFixed(2)}x` : '—'}
          color={overallROAS !== null && overallROAS >= 1 ? 'green' : 'amber'}
        />
        <StatCard label="Ad Leads" value={String(totalLeads)} color="indigo" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(EMPTY_FORM); setShowPaste(false) }}
          className="text-sm px-4 py-2.5 rounded-[10px] font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {showForm && !editingId ? 'Cancel' : '+ New Campaign'}
        </button>
        <button
          onClick={() => { setShowPaste(!showPaste); setShowForm(false) }}
          className="text-sm px-4 py-2.5 rounded-[10px] font-medium"
          style={{ background: 'var(--subtle-bg)', color: 'var(--text-heading)', border: '1px solid var(--card-border)' }}
        >
          {showPaste ? 'Cancel' : 'Paste FB Data'}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="card p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
            {editingId ? 'Edit Campaign' : 'New Campaign'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="w-full rounded-[10px] px-3 py-2.5 text-sm"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-heading)' }}
              placeholder="Campaign name (e.g. Summer Debut Ad)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <select
              className="w-full rounded-[10px] px-3 py-2.5 text-sm"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-heading)' }}
              value={form.platform}
              onChange={e => setForm(f => ({ ...f, platform: e.target.value as AdPlatform }))}
            >
              {(Object.keys(PLATFORM_LABELS) as AdPlatform[]).map(p => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
            <input
              className="w-full rounded-[10px] px-3 py-2.5 text-sm"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-heading)' }}
              placeholder="Spend (₱)"
              inputMode="numeric"
              value={form.spend}
              onChange={e => setForm(f => ({ ...f, spend: e.target.value }))}
            />
            <input
              className="w-full rounded-[10px] px-3 py-2.5 text-sm"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-heading)' }}
              type="date"
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            />
            <input
              className="w-full rounded-[10px] px-3 py-2.5 text-sm"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-heading)' }}
              type="date"
              placeholder="End date (optional)"
              value={form.end_date}
              onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            />
            <input
              className="w-full rounded-[10px] px-3 py-2.5 text-sm"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-heading)' }}
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <button
            onClick={save}
            disabled={saving || !form.name.trim() || !form.spend || !form.start_date}
            className="w-full py-2.5 rounded-[10px] text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? 'Saving…' : editingId ? 'Update Campaign' : 'Save Campaign'}
          </button>
        </div>
      )}

      {/* Paste FB Data */}
      {showPaste && (
        <div className="card p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Paste FB Ads Data</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Copy any text from Facebook Ads Manager — campaign name, spend, reach, impressions, dates. AI will parse it automatically.
          </p>
          <textarea
            className="w-full rounded-[10px] px-3 py-2.5 text-sm resize-none"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-heading)' }}
            rows={5}
            placeholder={'e.g.\nCampaign: Summer Debut Promo\nSpent: ₱2,500\nReach: 18,500\nImpressions: 24,000\nLeads: 42\nJune 1 – June 14, 2026'}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          <button
            onClick={parseFbData}
            disabled={parsing || !pasteText.trim()}
            className="w-full py-2.5 rounded-[10px] text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {parsing ? 'Parsing…' : 'Parse with AI'}
          </button>
          {parseReply && (
            <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>
              {parseReply}
            </div>
          )}
          {parsedForm && (
            <button
              onClick={applyParsed}
              className="w-full py-2.5 rounded-[10px] text-sm font-medium"
              style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid var(--success)' }}
            >
              Review &amp; Save Parsed Campaign →
            </button>
          )}
        </div>
      )}

      {/* Campaigns table */}
      {loading ? (
        <div className="card overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-4 w-16 ml-auto" />
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-16" />
            </div>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No campaigns yet</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Add a campaign manually or paste your FB Ads data above to get started.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead style={{ background: 'var(--card-elevated)', borderBottom: '1px solid var(--card-border)' }}>
              <tr>
                <th className="section-label text-left px-5 py-3">Campaign</th>
                <th className="section-label text-right px-5 py-3">Spend</th>
                <th className="section-label text-right px-5 py-3">Leads</th>
                <th className="section-label text-right px-5 py-3">Booked</th>
                <th className="section-label text-right px-5 py-3">Revenue</th>
                <th className="section-label text-right px-5 py-3">ROAS</th>
                <th className="section-label text-right px-5 py-3">CPL</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map(row => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border-secondary)' }} className="hover:bg-[var(--hover-bg)] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate max-w-[160px]" style={{ color: 'var(--text-heading)' }}>{row.name}</span>
                      <PlatformBadge platform={row.platform} />
                      {row.status === 'ended' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--subtle-bg)', color: 'var(--text-faint)' }}>ended</span>
                      )}
                    </div>
                    {row.start_date && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {row.start_date}{row.end_date ? ` → ${row.end_date}` : ''}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 tabular text-right font-medium" style={{ color: 'var(--danger)' }}>
                    ₱{row.spend.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 tabular text-right" style={{ color: 'var(--text-secondary)' }}>
                    {row.leads}
                  </td>
                  <td className="px-5 py-4 tabular text-right font-medium" style={{ color: 'var(--success)' }}>
                    {row.booked}
                  </td>
                  <td className="px-5 py-4 tabular text-right font-semibold" style={{ color: 'var(--money)' }}>
                    {row.revenue > 0 ? `₱${row.revenue.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-5 py-4 tabular text-right font-bold" style={{ color: row.roas !== null && row.roas >= 1 ? 'var(--success)' : row.roas !== null ? 'var(--danger)' : 'var(--text-faint)' }}>
                    {row.roas !== null ? `${row.roas.toFixed(2)}x` : '—'}
                  </td>
                  <td className="px-5 py-4 tabular text-right" style={{ color: 'var(--text-secondary)' }}>
                    {row.cpl !== null ? `₱${Math.round(row.cpl).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(row)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                        style={{ background: 'var(--subtle-bg)', color: 'var(--text-secondary)' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(row.id, row.name)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                        style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 rounded-xl p-4 text-sm" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle2)', color: 'var(--accent-text)' }}>
        <p className="font-semibold mb-1">How lead attribution works</p>
        <p style={{ color: 'var(--text-secondary)' }}>
          When you add a Facebook lead via Crafty AI, it will ask which campaign they came from. You can also say "the Maria Santos lead came from my Summer Debut campaign" at any time to attribute them.
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const vars: Record<string, { bg: string; text: string }> = {
    indigo: { bg: 'var(--accent-subtle)', text: 'var(--accent-text)' },
    green:  { bg: 'var(--success-muted)', text: 'var(--success)' },
    amber:  { bg: 'var(--warning-muted)', text: 'var(--warning)' },
    danger: { bg: 'var(--danger-muted)', text: 'var(--danger)' },
  }
  const v = vars[color] ?? vars.indigo
  return (
    <div className="rounded-xl p-4" style={{ background: v.bg, border: '1px solid var(--card-border)' }}>
      <p className="section-label">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular" style={{ color: v.text }}>{value}</p>
    </div>
  )
}

function PlatformBadge({ platform }: { platform: AdPlatform }) {
  const c = PLATFORM_COLORS[platform]
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0" style={{ background: c.bg, color: c.text }}>
      {PLATFORM_LABELS[platform]}
    </span>
  )
}
