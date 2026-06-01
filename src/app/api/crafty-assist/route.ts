import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function getSystemPrompt() {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return `You are Crafty — an AI assistant embedded inside Craftifyle CRM. You help James manage his photobooth and event photography business by reading and writing data directly to the CRM.

TODAY'S DATE: ${dateStr}. Always use this when calculating event timelines, interpreting relative dates ("next Saturday", "this June"), or describing how far away an event is.

You have tools to:
- Get leads (list, search by status)
- Create new leads
- Update existing leads (status, notes, contact info, event details)
- Get bookings
- Create new bookings
- Log payments (mark deposit or balance as paid)
- Get revenue summary

IMPORTANT RULES:
- When creating or updating data, always confirm what you did in plain language with the key details (amounts in ₱, dates, names).
- For dates, accept natural language like "June 28", "next Saturday", "June 28 2026" — always convert to YYYY-MM-DD format.
- For amounts, strip ₱ and commas before storing — store as plain numbers.
- If something is unclear, ask one short clarifying question before acting.
- Keep replies short and direct — no fluff.
- When you complete a DB action, start your reply with "Done —" so James knows it worked.
- If given a raw client inquiry or DM (e.g. prefixed with "Parse this:" or "New inquiry:"), extract name, event_type, event_date, venue, guest_count, package interest, and call create_lead immediately. Use source=facebook if it looks like a Messenger DM. Don't ask for confirmation unless the name is completely missing.

CRAFTIFYLE PACKAGES (for reference when creating leads/bookings):
- Photobooth Only: ₱3,500
- Photography Only: ₱4,500
- Photobooth + Photography Bundle: ₱6,500
- Premium Bundle: ₱8,000`
}

const TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_leads',
      description: 'Get leads from the CRM. Can filter by status and limit results.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost', 'completed'],
            description: 'Filter by lead status. Omit to get all leads.',
          },
          limit: { type: 'number', description: 'Max number of leads to return. Default 10.' },
          search: { type: 'string', description: 'Search by name or phone number.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Create a new lead in the CRM.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Client full name.' },
          phone: { type: 'string', description: 'Phone number.' },
          email: { type: 'string', description: 'Email address.' },
          facebook: { type: 'string', description: 'Facebook profile name or link.' },
          event_type: {
            type: 'string',
            enum: ['wedding', 'birthday', 'debut', 'corporate', 'christmas_party', 'reunion', 'baptism', 'other'],
          },
          event_date: { type: 'string', description: 'Event date in YYYY-MM-DD format.' },
          venue: { type: 'string' },
          guest_count: { type: 'number' },
          package: { type: 'string', description: 'Package name or description.' },
          budget: { type: 'number', description: 'Budget in PHP, no peso sign.' },
          source: {
            type: 'string',
            enum: ['facebook', 'instagram', 'referral', 'walk-in', 'website', 'tiktok', 'other'],
            description: 'Where the lead came from. Default: other.',
          },
          notes: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead',
      description: 'Update an existing lead by ID. Can update status, notes, contact info, event details.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Lead UUID.' },
          status: {
            type: 'string',
            enum: ['new', 'contacted', 'quoted', 'negotiating', 'booked', 'lost', 'completed'],
          },
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          event_type: {
            type: 'string',
            enum: ['wedding', 'birthday', 'debut', 'corporate', 'christmas_party', 'reunion', 'baptism', 'other'],
          },
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
  },
  {
    type: 'function',
    function: {
      name: 'get_bookings',
      description: 'Get bookings from the CRM.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['upcoming', 'completed', 'cancelled'],
            description: 'Filter by status. Default: upcoming.',
          },
          limit: { type: 'number', description: 'Max results. Default 10.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Create a new confirmed booking.',
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'log_payment',
      description: 'Mark a deposit or balance as paid on a booking.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: { type: 'string', description: 'Booking UUID.' },
          payment_type: {
            type: 'string',
            enum: ['deposit', 'balance'],
            description: 'Which payment to mark as paid.',
          },
          paid_date: { type: 'string', description: 'Date payment was received, YYYY-MM-DD. Defaults to today.' },
        },
        required: ['booking_id', 'payment_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'convert_lead_to_booking',
      description: 'Convert an existing lead to a confirmed booking. Fetches the lead\'s event details automatically and creates the booking. Updates the lead status to booked.',
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'get_revenue_summary',
      description: 'Get total revenue summary from bookings.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Filter by month in YYYY-MM format. Omit for all-time.' },
        },
      },
    },
  },
]

async function runTool(
  name: string,
  args: Record<string, unknown>,
  db: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string> {
  try {
    if (name === 'get_leads') {
      let query = db.from('leads').select('id, name, phone, event_type, event_date, package, budget, status, source, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit((args.limit as number) ?? 10)
      if (args.status) query = query.eq('status', args.status as string)
      if (args.search) query = query.ilike('name', `%${args.search}%`)
      const { data, error } = await query
      if (error) return `Error: ${error.message}`
      if (!data?.length) return 'No leads found.'
      return JSON.stringify(data)
    }

    if (name === 'create_lead') {
      const { data, error } = await db.from('leads').insert({
        user_id: userId,
        name: args.name,
        phone: args.phone ?? null,
        email: args.email ?? null,
        facebook: args.facebook ?? null,
        event_type: args.event_type ?? null,
        event_date: args.event_date ?? null,
        venue: args.venue ?? null,
        guest_count: args.guest_count ?? null,
        package: args.package ?? null,
        budget: args.budget ?? null,
        source: (args.source as string) ?? 'other',
        notes: args.notes ?? null,
        status: 'new',
      }).select('id, name').single()
      if (error) return `Error: ${error.message}`
      return `Created lead: ${data.name} (ID: ${data.id})`
    }

    if (name === 'update_lead') {
      const { id, ...fields } = args
      const updates: Record<string, unknown> = {}
      const allowed = ['status', 'name', 'phone', 'email', 'event_type', 'event_date', 'venue', 'guest_count', 'package', 'budget', 'notes']
      for (const key of allowed) {
        if (fields[key] !== undefined) updates[key] = fields[key]
      }
      updates.updated_at = new Date().toISOString()
      const { data, error } = await db.from('leads').update(updates)
        .eq('id', id as string).eq('user_id', userId).select('id, name').single()
      if (error) return `Error: ${error.message}`
      return `Updated lead: ${data.name} (ID: ${data.id})`
    }

    if (name === 'get_bookings') {
      const { data, error } = await db.from('bookings')
        .select('id, event_name, event_date, package_name, package_price, deposit_amount, deposit_paid, balance_amount, balance_paid, status')
        .eq('user_id', userId)
        .eq('status', (args.status as string) ?? 'upcoming')
        .order('event_date')
        .limit((args.limit as number) ?? 10)
      if (error) return `Error: ${error.message}`
      if (!data?.length) return 'No bookings found.'
      return JSON.stringify(data)
    }

    if (name === 'create_booking') {
      const packagePrice = (args.package_price as number) ?? 0
      const depositAmount = args.deposit_amount as number
      const balanceAmount = args.balance_amount as number
      const { data, error } = await db.from('bookings').insert({
        user_id: userId,
        event_name: args.event_name,
        event_date: args.event_date,
        event_time: args.event_time ?? null,
        venue: args.venue ?? null,
        package_name: args.package_name ?? null,
        package_price: packagePrice,
        deposit_amount: depositAmount,
        deposit_paid: (args.deposit_paid as boolean) ?? false,
        deposit_paid_date: (args.deposit_paid as boolean) ? (args.paid_date ?? new Date().toISOString().slice(0, 10)) : null,
        balance_amount: balanceAmount,
        balance_paid: false,
        balance_paid_date: null,
        status: 'upcoming',
        craftifyle_income: packagePrice,
        personal_income: 0,
        notes: args.notes ?? null,
        lead_id: args.lead_id ?? null,
        gcal_event_id: null,
      }).select('id, event_name').single()
      if (error) return `Error: ${error.message}`
      return `Created booking: ${data.event_name} (ID: ${data.id})`
    }

    if (name === 'log_payment') {
      const today = new Date().toISOString().slice(0, 10)
      const paidDate = (args.paid_date as string) ?? today
      const field = args.payment_type === 'deposit'
        ? { deposit_paid: true, deposit_paid_date: paidDate }
        : { balance_paid: true, balance_paid_date: paidDate }
      const { data, error } = await db.from('bookings').update(field)
        .eq('id', args.booking_id as string).eq('user_id', userId).select('id, event_name').single()
      if (error) return `Error: ${error.message}`
      return `Marked ${args.payment_type} as paid for booking: ${data.event_name}`
    }

    if (name === 'get_revenue_summary') {
      let query = db.from('bookings').select('craftifyle_income, package_price, deposit_paid, balance_paid, event_date')
        .eq('user_id', userId)
        .neq('status', 'cancelled')
      if (args.month) {
        const [y, m] = (args.month as string).split('-')
        const start = `${y}-${m}-01`
        const end = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10)
        query = query.gte('event_date', start).lte('event_date', end)
      }
      const { data, error } = await query
      if (error) return `Error: ${error.message}`
      const total = data?.reduce((sum, b) => sum + (b.package_price ?? 0), 0) ?? 0
      const collected = data?.reduce((sum, b) => {
        let s = 0
        const booking = b as { deposit_paid: boolean; balance_paid: boolean; package_price: number | null; craftifyle_income: number }
        if (booking.deposit_paid) s += booking.craftifyle_income * 0.15
        if (booking.balance_paid) s += booking.craftifyle_income
        return sum + s
      }, 0) ?? 0
      return JSON.stringify({ total_bookings: data?.length ?? 0, total_revenue: total, bookings: data })
    }

    if (name === 'convert_lead_to_booking') {
      // Find lead by ID or name
      let lead: Record<string, unknown> | null = null
      if (args.lead_id) {
        const { data } = await db.from('leads').select('*').eq('id', args.lead_id as string).eq('user_id', userId).single()
        lead = data
      } else if (args.lead_name) {
        const { data } = await db.from('leads').select('*').ilike('name', `%${args.lead_name as string}%`).eq('user_id', userId).limit(1).single()
        lead = data
      }
      if (!lead) return 'Lead not found. Try providing the lead name or ID.'
      if (!lead.event_date) return `Lead found (${lead.name}) but has no event date set. Please update the lead with an event date first.`

      const packagePrice = (lead.budget as number) ?? (lead.package ? 6500 : 0)
      const depositAmount = (args.deposit_amount as number) ?? 1000
      const balanceAmount = Math.max(0, packagePrice - depositAmount)
      const depositPaid = (args.deposit_paid as boolean) ?? false
      const today = new Date().toISOString().slice(0, 10)

      const { data: booking, error } = await db.from('bookings').insert({
        user_id: userId,
        lead_id: lead.id,
        event_name: `${lead.name}'s ${(lead.event_type as string)?.replace('_', ' ') ?? 'Event'}`,
        event_date: lead.event_date,
        event_time: (args.event_time as string) ?? null,
        venue: lead.venue ?? null,
        package_name: (lead.package as string) ?? null,
        package_price: packagePrice,
        deposit_amount: depositAmount,
        deposit_paid: depositPaid,
        deposit_paid_date: depositPaid ? today : null,
        balance_amount: balanceAmount,
        balance_paid: false,
        balance_paid_date: null,
        status: 'upcoming',
        craftifyle_income: packagePrice,
        personal_income: 0,
        notes: (args.notes as string) ?? null,
        gcal_event_id: null,
      }).select('id, event_name').single()
      if (error) return `Error: ${error.message}`

      await db.from('leads').update({ status: 'booked', updated_at: new Date().toISOString() }).eq('id', lead.id as string)
      return `Converted to booking: ${booking.event_name} on ${lead.event_date}. Deposit: ₱${depositAmount}${depositPaid ? ' (paid)' : ' (unpaid)'}. Balance: ₱${balanceAmount}. Booking ID: ${booking.id}`
    }

    return `Unknown tool: ${name}`
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Groq API key not configured.' }, { status: 500 })

  const db = createAdminClient()
  const groq = new Groq({ apiKey })

  const chatMessages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: getSystemPrompt() },
    ...messages,
  ]

  // Tool-calling loop — max 3 rounds
  for (let round = 0; round < 3; round++) {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: chatMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1024,
    })

    const choice = completion.choices[0]
    const msg = choice.message

    if (!msg.tool_calls?.length) {
      return NextResponse.json({ reply: msg.content ?? '' })
    }

    // Execute each tool call
    chatMessages.push({ role: 'assistant', tool_calls: msg.tool_calls, content: msg.content ?? '' })

    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments) as Record<string, unknown>
      const result = await runTool(call.function.name, args, db, user.id)
      chatMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result,
      })
    }
  }

  return NextResponse.json({ reply: 'Done processing your request.' })
}
