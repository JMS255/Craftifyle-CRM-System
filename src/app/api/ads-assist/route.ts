import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'

export const maxDuration = 60

interface ExistingCampaign { id: string; name: string }

interface ParsedCampaign {
  name?: string
  platform?: string
  spend?: number
  impressions?: number
  clicks?: number
  reach?: number
  start_date?: string
  end_date?: string
}

const TOOLS = [{ functionDeclarations: [
  {
    name: 'create_campaign',
    description: 'Create a new ad campaign from the parsed data.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name.' },
        platform: { type: 'string', enum: ['facebook', 'instagram', 'tiktok', 'google'], description: 'Ad platform. Default: facebook.' },
        spend: { type: 'number', description: 'Total spend in PHP — strip ₱ and commas.' },
        impressions: { type: 'number', description: 'Total impressions if present.' },
        clicks: { type: 'number', description: 'Total link clicks if present.' },
        reach: { type: 'number', description: 'Total reach if present.' },
        start_date: { type: 'string', description: 'Campaign start date YYYY-MM-DD.' },
        end_date: { type: 'string', description: 'Campaign end date YYYY-MM-DD.' },
      },
      required: ['name', 'spend'],
    },
  },
  {
    name: 'update_campaign',
    description: 'Update an existing campaign. Use when the pasted data matches an existing campaign name.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Existing campaign Firestore doc ID.' },
        spend: { type: 'number', description: 'Updated total spend in PHP.' },
        impressions: { type: 'number' },
        clicks: { type: 'number' },
        reach: { type: 'number' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD.' },
        status: { type: 'string', enum: ['active', 'ended'] },
      },
      required: ['id'],
    },
  },
]}]

let lastCampaign: ParsedCampaign | null = null

async function runTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<string> {
  const now = new Date().toISOString()

  if (name === 'create_campaign') {
    const payload = {
      name: args.name as string,
      platform: (args.platform as string) ?? 'facebook',
      spend: args.spend as number,
      ...(args.impressions !== undefined ? { impressions: args.impressions as number } : {}),
      ...(args.clicks !== undefined ? { clicks: args.clicks as number } : {}),
      ...(args.reach !== undefined ? { reach: args.reach as number } : {}),
      ...(args.start_date ? { start_date: args.start_date as string } : {}),
      ...(args.end_date ? { end_date: args.end_date as string } : {}),
      status: 'active',
      user_id: userId,
      created_at: now,
      updated_at: now,
    }
    const ref = await adminDb.collection('ad_campaigns').add(payload)
    lastCampaign = { ...payload, name: payload.name }
    return `Created campaign "${payload.name}" (ID: ${ref.id}) — spend ₱${payload.spend.toLocaleString()}`
  }

  if (name === 'update_campaign') {
    const { id, ...fields } = args
    const updates: Record<string, unknown> = { updated_at: now }
    const allowed = ['spend', 'impressions', 'clicks', 'reach', 'end_date', 'status']
    for (const key of allowed) {
      if (fields[key] !== undefined) updates[key] = fields[key]
    }
    const ref = adminDb.collection('ad_campaigns').doc(id as string)
    const snap = await ref.get()
    if (!snap.exists || snap.data()?.user_id !== userId) return 'Campaign not found.'
    await ref.update(updates)
    lastCampaign = { name: snap.data()?.name, ...updates } as ParsedCampaign
    return `Updated campaign "${snap.data()?.name}" — spend ₱${(updates.spend ?? snap.data()?.spend ?? 0).toLocaleString()}`
  }

  return `Unknown tool: ${name}`
}

function buildSystemPrompt(existing: ExistingCampaign[]) {
  const dateStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const existingSection = existing.length
    ? `EXISTING CAMPAIGNS (check before creating — update if name matches):\n${existing.map(c => `- "${c.name}" (ID: ${c.id})`).join('\n')}`
    : 'EXISTING CAMPAIGNS: None yet.'

  return `You are an AI assistant that parses raw Facebook Ads Manager data for a photobooth business CRM.

TODAY'S DATE: ${dateStr}

${existingSection}

RULES:
- User will paste raw text from FB Ads Manager or any ad platform.
- Extract: campaign name, spend (strip ₱ and commas, convert to number), impressions, reach, clicks, date range.
- Convert date ranges to YYYY-MM-DD format using today's year if not specified.
- If a campaign with a similar name already exists, call update_campaign with its ID instead of creating a new one.
- Platform defaults to "facebook" unless clearly stated otherwise.
- NEVER ask the user for a campaign name. If no explicit name is found, infer one from context clues — the post caption, event type (debut, wedding, birthday), date, or location. Examples: "June Debut Boost", "Fatima Debut Jun 2026", "Summer Event Promo". Always call create_campaign immediately with the inferred name.
- After calling a tool, respond with a short confirmation like "Done — saved as [name], spend ₱X, reach X." and mention the inferred name so the user can rename it if needed.
- Plain text only, no markdown.`
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

  const { messages, existing = [] } = await req.json() as { messages: { role: string; content: string }[]; existing?: ExistingCampaign[] }
  if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured.' }, { status: 500 })

  // Merge existing from client with a fresh DB fetch to avoid stale data
  const snap = await adminDb.collection('ad_campaigns').where('user_id', '==', userId).get()
  const dbExisting: ExistingCampaign[] = snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, name: (d.data() as { name: string }).name }))
  const allExisting = dbExisting.length ? dbExisting : existing

  lastCampaign = null

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: buildSystemPrompt(allExisting),
    tools: TOOLS,
  })

  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }))

  const chat = model.startChat({ history })
  let result = await chat.sendMessage(messages[messages.length - 1].content)

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

  return NextResponse.json({ reply, campaign: lastCampaign })
}
