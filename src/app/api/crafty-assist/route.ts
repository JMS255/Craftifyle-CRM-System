import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
import type { QueryDocumentSnapshot, DocumentReference } from 'firebase-admin/firestore'

export const maxDuration = 60

interface PackageRow { name: string; price: number; description: string | null; is_addon: boolean }
interface AiProfile {
  business_name?: string; business_description?: string; pricing_model?: string
  ai_rules?: string; ai_tone?: string; ai_context?: string
  ai_pdfs?: Array<{ name: string; text: string }>
}

const TONE_LABELS: Record<string, string> = {
  casual_taglish: 'Casual Taglish — warm, uses "po", mix of Filipino and English',
  casual_english: 'Casual English — friendly and approachable',
  formal_english: 'Formal English — professional and precise',
}

function getSystemPrompt(packages: PackageRow[], ai: AiProfile) {
  const dateStr = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const businessName = ai.business_name?.trim() || 'Craftifyle'
  const isCustomized = !!(ai.business_description?.trim() || ai.pricing_model?.trim() || ai.ai_rules?.trim())
  const tone = TONE_LABELS[ai.ai_tone ?? ''] ?? TONE_LABELS.casual_taglish

  const bases = packages.filter(p => !p.is_addon)
  const addons = packages.filter(p => p.is_addon)
  const packagesSection = bases.length > 0
    ? `PACKAGES — use EXACT prices when creating bookings:\n${bases.map(p =>
        `- "${p.name}" → ₱${p.price.toLocaleString()}${p.description ? ` (${p.description})` : ''}`
      ).join('\n')}`
    : isCustomized
      ? 'PACKAGES — none set yet. Ask the user to add packages in Settings > Packages.'
      : `PACKAGES — use EXACT prices when creating bookings:
- "Photobooth Only" → ₱3,500
- "Photography Only" → ₱4,500
- "Photobooth + Photography" → ₱6,500
- "Premium Bundle" → ₱8,000`
  const addonsSection = addons.length > 0
    ? `ADD-ONS:\n${addons.map(p => `- "${p.name}" → ${p.price === 0 ? 'FREE' : `+₱${p.price.toLocaleString()}`}`).join('\n')}`
    : ''

  const businessSection = isCustomized ? `
ABOUT THIS BUSINESS:
${ai.business_description || '(not set)'}

HOW WE PRICE:
${ai.pricing_model || '(not set)'}

${ai.ai_context?.trim() ? `ADDITIONAL CONTEXT:\n${ai.ai_context}` : ''}` : `
ABOUT THIS BUSINESS:
Craftifyle — photobooth and event photography in Zamboanga City, Philippines.`

  const rulesSection = isCustomized && ai.ai_rules?.trim()
    ? `\nOWNER-DEFINED RULES (follow these strictly):\n${ai.ai_rules}`
    : ''

  const pdfsSection = ai.ai_pdfs?.length
    ? `\nKNOWLEDGE BASE (from uploaded documents):\n${ai.ai_pdfs.map(p => `--- ${p.name} ---\n${p.text}`).join('\n\n')}`
    : ''

  return `You are Crafty — an AI assistant embedded inside ${businessName} CRM. You help the owner manage their business by reading and writing data directly to the CRM.

TODAY'S DATE: ${dateStr}. Use this for event timelines, relative dates ("next Saturday"), and urgency calculations.
${businessSection}
You have tools to: get/create/update leads, get/create bookings, log payments, get revenue summary, convert leads to bookings, and manage ad campaign attribution.

CORE RULES:
- Confirm every DB action with key details (amounts in ₱, dates, names). Start with "Done —".
- Accept natural language dates ("June 28", "next Saturday") — convert to YYYY-MM-DD.
- Strip ₱ and commas from amounts before storing.
- Ask one clarifying question if unclear — never guess critical fields.
- Plain text only — no markdown tables, no bullet lists with asterisks.
- When given a raw DM or inquiry, extract lead fields and call create_lead immediately.
- When creating a lead with source "facebook", after saving ask: "Did this lead come from one of your ad campaigns, or was it organic/direct?" If they name a campaign, call attribute_lead_to_campaign. If they say organic or direct, skip attribution.
${rulesSection}

REPLY TONE: ${tone}

${packagesSection}
${addonsSection}${pdfsSection}`
}

const TOOLS = [{ functionDeclarations: [
  {
    name: 'get_leads',
    description: 'Get leads from the CRM. Can filter by status and limit results.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost', 'completed'], description: 'Filter by lead status. Omit to get all leads.' },
        limit: { type: 'number', description: 'Max number of leads to return. Default 10.' },
        search: { type: 'string', description: 'Search by name or phone number.' },
      },
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new lead in the CRM.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Client full name.' },
        phone: { type: 'string', description: 'Phone number.' },
        email: { type: 'string', description: 'Email address.' },
        facebook: { type: 'string', description: 'Facebook profile name or link.' },
        event_type: { type: 'string', enum: ['wedding', 'birthday', 'debut', 'corporate', 'christmas_party', 'reunion', 'baptism', 'other'] },
        event_date: { type: 'string', description: 'Event date in YYYY-MM-DD format.' },
        venue: { type: 'string' },
        guest_count: { type: 'number' },
        package: { type: 'string', description: 'Package name or description.' },
        budget: { type: 'number', description: 'Budget in PHP, no peso sign.' },
        source: { type: 'string', enum: ['facebook', 'instagram', 'referral', 'walk-in', 'website', 'tiktok', 'other'], description: 'Where the lead came from. Default: other.' },
        notes: { type: 'string' },
        ad_campaign_id: { type: 'string', description: 'Optional. Link this lead to an ad campaign by ID.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_lead',
    description: 'Update an existing lead by ID. Can update status, notes, contact info, event details.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Lead UUID.' },
        status: { type: 'string', enum: ['new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost', 'completed'] },
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        event_type: { type: 'string', enum: ['wedding', 'birthday', 'debut', 'corporate', 'christmas_party', 'reunion', 'baptism', 'other'] },
        event_date: { type: 'string', description: 'YYYY-MM-DD' },
        venue: { type: 'string' },
        guest_count: { type: 'number' },
        package: { type: 'string' },
        budget: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_bookings',
    description: 'Get bookings from the CRM.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['upcoming', 'completed', 'cancelled'], description: 'Filter by status. Default: upcoming.' },
        limit: { type: 'number', description: 'Max results. Default 10.' },
      },
    },
  },
  {
    name: 'create_booking',
    description: 'Create a new confirmed booking.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        event_name: { type: 'string', description: 'Name of the event, e.g. "Santos Wedding".' },
        event_date: { type: 'string', description: 'YYYY-MM-DD' },
        event_time: { type: 'string', description: 'HH:MM format, e.g. "14:00".' },
        venue: { type: 'string' },
        package_name: { type: 'string' },
        package_price: { type: 'number', description: 'Total package price in PHP.' },
        deposit_amount: { type: 'number', description: 'Deposit amount in PHP.' },
        deposit_paid: { type: 'boolean', description: 'Whether deposit has been paid. Default false.' },
        balance_amount: { type: 'number', description: 'Balance amount in PHP.' },
        notes: { type: 'string' },
        lead_id: { type: 'string', description: 'Link to an existing lead by UUID.' },
      },
      required: ['event_name', 'event_date', 'deposit_amount', 'balance_amount'],
    },
  },
  {
    name: 'log_payment',
    description: 'Mark a deposit or balance as paid on a booking.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        booking_id: { type: 'string', description: 'Booking UUID.' },
        payment_type: { type: 'string', enum: ['deposit', 'balance'], description: 'Which payment to mark as paid.' },
        paid_date: { type: 'string', description: 'Date payment was received, YYYY-MM-DD. Defaults to today.' },
      },
      required: ['booking_id', 'payment_type'],
    },
  },
  {
    name: 'get_urgent_leads',
    description: 'Get leads that need immediate attention — sorted by urgency. Returns leads with upcoming events, quiet leads that need follow-up, and leads where the event has passed.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results. Default 10.' },
      },
    },
  },
  {
    name: 'convert_lead_to_booking',
    description: "Convert an existing lead to a confirmed booking. Fetches the lead's event details automatically and creates the booking. Updates the lead status to booked.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Lead UUID to convert.' },
        lead_name: { type: 'string', description: 'Lead name to search by (used if lead_id not known).' },
        deposit_amount: { type: 'number', description: 'Deposit amount in PHP. Defaults to 1000 if not specified.' },
        deposit_paid: { type: 'boolean', description: 'Whether deposit has already been paid. Default false.' },
        event_time: { type: 'string', description: 'Event time in HH:MM format.' },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'get_revenue_summary',
    description: 'Get total revenue summary from bookings.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Filter by month in YYYY-MM format. Omit for all-time.' },
      },
    },
  },
  {
    name: 'get_ad_campaigns',
    description: 'Get all ad campaigns for the user. Use when attributing a lead to a campaign or when the user asks about their campaigns.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_campaign_stats',
    description: 'Update the raw lead/booking/revenue counts on an ad campaign. Use when the user says "I got X leads and Y bookings from [campaign]" or wants to update campaign results.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign UUID if known.' },
        campaign_name: { type: 'string', description: 'Campaign name to fuzzy match.' },
        leads_raw: { type: 'number', description: 'Total leads/conversations from this ad.' },
        booked_raw: { type: 'number', description: 'Total bookings from this ad.' },
        revenue_raw: { type: 'number', description: 'Total revenue in PHP from this ad.' },
      },
    },
  },
  {
    name: 'attribute_lead_to_campaign',
    description: 'Link an existing lead to an ad campaign. Call this when the user says a lead came from a specific ad.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Lead UUID. Provide if known.' },
        lead_name: { type: 'string', description: 'Lead name to search by if ID not known.' },
        campaign_id: { type: 'string', description: 'Campaign UUID. Provide if known.' },
        campaign_name: { type: 'string', description: 'Campaign name to fuzzy match if ID not known. Use "organic" or "referral" to clear attribution.' },
      },
    },
  },
]}]

async function runTool(name: string, args: Record<string, unknown>, userId: string): Promise<string> {
  try {
    if (name === 'get_leads') {
      const snap = await adminDb.collection('leads').get()
      let data = snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[]
      data = data.filter(l => l.user_id === userId)
      if (args.status) data = data.filter(l => l.status === args.status)
      if (args.search) data = data.filter(l => String(l.name ?? '').toLowerCase().includes((args.search as string).toLowerCase()))
      data = data.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
      data = data.slice(0, (args.limit as number) ?? 10)
      if (!data.length) return 'No leads found.'
      return JSON.stringify(data.map(l => ({ id: l.id, name: l.name, phone: l.phone, event_type: l.event_type, event_date: l.event_date, package: l.package, budget: l.budget, status: l.status, source: l.source, created_at: l.created_at })))
    }

    if (name === 'create_lead') {
      const now = new Date().toISOString()
      const ref = await adminDb.collection('leads').add({
        user_id: userId, name: args.name, phone: args.phone ?? null, email: args.email ?? null,
        facebook: args.facebook ?? null, event_type: args.event_type ?? null, event_date: args.event_date ?? null,
        venue: args.venue ?? null, guest_count: args.guest_count ?? null, package: args.package ?? null,
        budget: args.budget ?? null, source: (args.source as string) ?? 'other', notes: args.notes ?? null,
        ad_campaign_id: args.ad_campaign_id ?? null,
        status: 'new', created_at: now, updated_at: now,
      })
      return `Created lead: ${args.name} (ID: ${ref.id})`
    }

    if (name === 'update_lead') {
      const { id, ...fields } = args
      const updates: Record<string, unknown> = {}
      const allowed = ['status', 'name', 'phone', 'email', 'event_type', 'event_date', 'venue', 'guest_count', 'package', 'budget', 'notes']
      for (const key of allowed) { if (fields[key] !== undefined) updates[key] = fields[key] }
      updates.updated_at = new Date().toISOString()
      await adminDb.collection('leads').doc(id as string).update(updates)
      return `Updated lead ID: ${id}`
    }

    if (name === 'get_bookings') {
      const snap = await adminDb.collection('bookings').get()
      let data = snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[]
      data = data.filter(b => b.user_id === userId && b.status === ((args.status as string) ?? 'upcoming'))
      data = data.sort((a, b) => String(a.event_date ?? '').localeCompare(String(b.event_date ?? '')))
      data = data.slice(0, (args.limit as number) ?? 10)
      if (!data.length) return 'No bookings found.'
      return JSON.stringify(data.map(b => ({ id: b.id, event_name: b.event_name, event_date: b.event_date, package_name: b.package_name, package_price: b.package_price, deposit_amount: b.deposit_amount, deposit_paid: b.deposit_paid, balance_amount: b.balance_amount, balance_paid: b.balance_paid, status: b.status })))
    }

    if (name === 'create_booking') {
      const packagePrice = (args.package_price as number) ?? 0
      const depositAmount = args.deposit_amount as number
      const balanceAmount = args.balance_amount as number
      const depositPaid = (args.deposit_paid as boolean) ?? false
      const today = new Date().toISOString().slice(0, 10)
      const now = new Date().toISOString()
      const ref = await adminDb.collection('bookings').add({
        user_id: userId, event_name: args.event_name, event_date: args.event_date, event_time: args.event_time ?? null,
        venue: args.venue ?? null, package_name: args.package_name ?? null, package_price: packagePrice,
        deposit_amount: depositAmount, deposit_paid: depositPaid,
        deposit_paid_date: depositPaid ? today : null, balance_amount: balanceAmount,
        balance_paid: false, balance_paid_date: null, status: 'upcoming',
        craftifyle_income: packagePrice, personal_income: 0, notes: args.notes ?? null,
        lead_id: args.lead_id ?? null, gcal_event_id: null, created_at: now, updated_at: now,
      })
      return `Created booking: ${args.event_name} (ID: ${ref.id})`
    }

    if (name === 'log_payment') {
      const today = new Date().toISOString().slice(0, 10)
      const paidDate = (args.paid_date as string) ?? today
      const field = args.payment_type === 'deposit'
        ? { deposit_paid: true, deposit_paid_date: paidDate }
        : { balance_paid: true, balance_paid_date: paidDate }
      const bookingRef = adminDb.collection('bookings').doc(args.booking_id as string)
      const snap = await bookingRef.get()
      if (!snap.exists) return 'Booking not found.'
      await bookingRef.update(field)
      return `Marked ${args.payment_type} as paid for booking: ${snap.data()?.event_name}`
    }

    if (name === 'get_revenue_summary') {
      const snap = await adminDb.collection('bookings').get()
      let data = snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[]
      data = data.filter(b => b.user_id === userId && b.status !== 'cancelled')
      if (args.month) {
        const [y, m] = (args.month as string).split('-')
        const start = `${y}-${m}-01`
        const end = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10)
        data = data.filter(b => String(b.event_date ?? '') >= start && String(b.event_date ?? '') <= end)
      }
      const total = data.reduce((sum, b) => sum + ((b.package_price as number) ?? 0), 0)
      return JSON.stringify({ total_bookings: data.length, total_revenue: total, bookings: data })
    }

    if (name === 'get_urgent_leads') {
      const snap = await adminDb.collection('leads').get()
      let data = snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[]
      data = data.filter(l => l.user_id === userId && !['booked', 'completed', 'lost'].includes(l.status as string))
      const now = Date.now()
      const scored = data.map(l => {
        const eventMs = l.event_date ? new Date(l.event_date as string).getTime() : null
        const daysToEvent = eventMs != null ? Math.floor((eventMs - now) / 86400000) : null
        const daysSilent = Math.floor((now - new Date(l.updated_at as string).getTime()) / 86400000)
        let urgency = 10; let action = 'Active'
        if (daysToEvent != null && daysToEvent < 0) { urgency = 100; action = 'Event passed — close it' }
        else if (daysToEvent != null && daysToEvent <= 3) { urgency = 90; action = `Event in ${daysToEvent}d — confirm now!` }
        else if (daysToEvent != null && daysToEvent <= 14) { urgency = 70; action = `Event in ${daysToEvent}d — follow up` }
        else if (['quoted', 'negotiating'].includes(l.status as string) && daysSilent >= 7) { urgency = 60; action = `Quiet ${daysSilent}d — follow up` }
        else if (l.status === 'new' && daysSilent >= 3) { urgency = 40; action = `New, ${daysSilent}d old — first contact` }
        return { ...l, urgency, action, daysToEvent, daysSilent }
      }).sort((a, b) => b.urgency - a.urgency).filter(l => l.urgency >= 40)
      if (!scored.length) return 'All leads are up to date — nothing urgent right now.'
      return JSON.stringify(scored.slice(0, (args.limit as number) ?? 10))
    }

    if (name === 'convert_lead_to_booking') {
      let lead: Record<string, unknown> | null = null
      if (args.lead_id) {
        const snap = await adminDb.collection('leads').doc(args.lead_id as string).get()
        if (snap.exists) lead = { id: snap.id, ...snap.data() }
      } else if (args.lead_name) {
        const snap = await adminDb.collection('leads').get()
        const all = snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() })) as Record<string, unknown>[]
        lead = all.find(l => l.user_id === userId && String(l.name ?? '').toLowerCase().includes((args.lead_name as string).toLowerCase())) ?? null
      }
      if (!lead) return 'Lead not found.'
      if (!lead.event_date) return `Lead found (${lead.name}) but has no event date set.`
      const PACKAGE_PRICES: Record<string, number> = { 'Photobooth Only': 3500, 'Photography Only': 4500, 'Photobooth + Photography': 6500, 'Premium Bundle': 8000 }
      const pkgName = (lead.package as string) ?? ''
      const lookedUp = Object.entries(PACKAGE_PRICES).find(([k]) => pkgName.toLowerCase().includes(k.toLowerCase()))
      const packagePrice = lookedUp?.[1] ?? (lead.budget as number) ?? 6500
      const depositAmount = (args.deposit_amount as number) ?? 1000
      const balanceAmount = Math.max(0, packagePrice - depositAmount)
      const depositPaid = (args.deposit_paid as boolean) ?? false
      const today = new Date().toISOString().slice(0, 10)
      const now = new Date().toISOString()
      const bookingRef = await adminDb.collection('bookings').add({
        user_id: userId, lead_id: lead.id,
        event_name: `${lead.name}'s ${(lead.event_type as string)?.replace('_', ' ') ?? 'Event'}`,
        event_date: lead.event_date, event_time: (args.event_time as string) ?? null,
        venue: lead.venue ?? null, package_name: (lead.package as string) ?? null,
        package_price: packagePrice, deposit_amount: depositAmount, deposit_paid: depositPaid,
        deposit_paid_date: depositPaid ? today : null, balance_amount: balanceAmount,
        balance_paid: false, balance_paid_date: null, status: 'upcoming',
        craftifyle_income: packagePrice, personal_income: 0, notes: (args.notes as string) ?? null,
        gcal_event_id: null, created_at: now, updated_at: now,
      })
      await adminDb.collection('leads').doc(lead.id as string).update({ status: 'booked', updated_at: now })
      return `Converted to booking: ${lead.event_name ?? lead.name}'s event on ${lead.event_date}. Deposit: ₱${depositAmount}${depositPaid ? ' (paid)' : ' (unpaid)'}. Balance: ₱${balanceAmount}. Booking ID: ${bookingRef.id}`
    }

    if (name === 'update_campaign_stats') {
      let ref: DocumentReference | null = null
      let cName = ''
      if (args.campaign_id) {
        ref = adminDb.collection('ad_campaigns').doc(args.campaign_id as string)
        const s = await ref.get()
        if (!s.exists || s.data()?.user_id !== userId) return 'Campaign not found.'
        cName = (s.data() as Record<string, unknown>).name as string
      } else if (args.campaign_name) {
        const snap = await adminDb.collection('ad_campaigns').where('user_id', '==', userId).get()
        const lower = (args.campaign_name as string).toLowerCase()
        const found = snap.docs.find((d: QueryDocumentSnapshot) => {
          const stored = String(d.data().name ?? '').toLowerCase()
          return stored.includes(lower) || lower.includes(stored)
        })
        if (!found) return `Campaign "${args.campaign_name}" not found. Use get_ad_campaigns to list them.`
        ref = found.ref
        cName = (found.data() as Record<string, unknown>).name as string
      } else {
        return 'Provide campaign_id or campaign_name.'
      }
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (args.leads_raw !== undefined) updates.leads_raw = args.leads_raw
      if (args.booked_raw !== undefined) updates.booked_raw = args.booked_raw
      if (args.revenue_raw !== undefined) updates.revenue_raw = args.revenue_raw
      await ref.update(updates)
      const parts = []
      if (args.leads_raw !== undefined) parts.push(`${args.leads_raw} leads`)
      if (args.booked_raw !== undefined) parts.push(`${args.booked_raw} bookings`)
      if (args.revenue_raw !== undefined) parts.push(`₱${(args.revenue_raw as number).toLocaleString()} revenue`)
      return `Updated "${cName}" — ${parts.join(', ')}.`
    }

    if (name === 'get_ad_campaigns') {
      const snap = await adminDb.collection('ad_campaigns').where('user_id', '==', userId).get()
      if (!snap.docs.length) return 'No ad campaigns found.'
      const rows = snap.docs.map((d: QueryDocumentSnapshot) => {
        const data = d.data() as Record<string, unknown>
        return `- "${data.name}" (ID: ${d.id}, platform: ${data.platform}, spend: ₱${(data.spend as number).toLocaleString()}, status: ${data.status})`
      })
      return rows.join('\n')
    }

    if (name === 'attribute_lead_to_campaign') {
      // Resolve lead
      let leadId = args.lead_id as string | undefined
      if (!leadId && args.lead_name) {
        const snap = await adminDb.collection('leads').where('user_id', '==', userId).get()
        const lower = (args.lead_name as string).toLowerCase()
        const found = snap.docs.find((d: QueryDocumentSnapshot) => String(d.data().name ?? '').toLowerCase().includes(lower))
        if (!found) return `Lead "${args.lead_name}" not found.`
        leadId = found.id
      }
      if (!leadId) return 'Provide lead_id or lead_name.'

      const clearAttribution = ['organic', 'referral', 'none', 'direct'].includes(String(args.campaign_name ?? '').toLowerCase())

      let campaignId: string | null = null
      let campaignName = 'Organic'

      if (!clearAttribution) {
        // Resolve campaign
        if (args.campaign_id) {
          campaignId = args.campaign_id as string
          const cSnap = await adminDb.collection('ad_campaigns').doc(campaignId).get()
          campaignName = cSnap.exists ? (cSnap.data() as Record<string, unknown>).name as string : campaignId
        } else if (args.campaign_name) {
          const cSnap = await adminDb.collection('ad_campaigns').where('user_id', '==', userId).get()
          const lower = (args.campaign_name as string).toLowerCase()
          const found = cSnap.docs.find((d: QueryDocumentSnapshot) => {
            const stored = String(d.data().name ?? '').toLowerCase()
            return stored.includes(lower) || lower.includes(stored)
          })
          if (!found) return `Campaign "${args.campaign_name}" not found. Use get_ad_campaigns to see available campaigns.`
          campaignId = found.id
          campaignName = (found.data() as Record<string, unknown>).name as string
        } else {
          return 'Provide campaign_id or campaign_name.'
        }
      }

      await adminDb.collection('leads').doc(leadId).update({
        ad_campaign_id: campaignId,
        updated_at: new Date().toISOString(),
      })
      return clearAttribution
        ? `Cleared campaign attribution for lead — marked as organic.`
        : `Attributed lead to campaign "${campaignName}".`
    }

    return `Unknown tool: ${name}`
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value
  if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let userId: string
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    userId = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured.' }, { status: 500 })

  // Fetch user's custom packages and AI profile settings in parallel
  const [pkgsSnap, profileSnap] = await Promise.all([
    adminDb.collection('packages').get(),
    adminDb.collection('profiles').doc(userId).get(),
  ])
  type PkgDoc = PackageRow & { id: string; user_id: string; is_active: boolean; sort_order: number }
  const allPkgs = pkgsSnap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }) as unknown as PkgDoc)
  const packages: PackageRow[] = allPkgs
    .filter((p: PkgDoc) => p.user_id === userId && p.is_active)
    .sort((a: PkgDoc, b: PkgDoc) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const aiProfile: AiProfile = profileSnap.exists ? (profileSnap.data() as AiProfile) : {}

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: getSystemPrompt(packages, aiProfile),
    tools: TOOLS,
  })

  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }))

  const chat = model.startChat({ history })
  let result = await chat.sendMessage(messages[messages.length - 1].content)

  // Tool-calling loop — max 3 rounds
  for (let round = 0; round < 3; round++) {
    const calls = result.response.functionCalls()
    if (!calls?.length) break

    const toolResults = await Promise.all(
      calls.map(async call => ({
        functionResponse: {
          name: call.name,
          response: { result: await runTool(call.name, call.args as Record<string, unknown>, userId) },
        },
      }))
    )
    result = await chat.sendMessage(toolResults)
  }

  let reply = ''
  try { reply = result.response.text() } catch { reply = 'Done.' }
  return NextResponse.json({ reply })
}
