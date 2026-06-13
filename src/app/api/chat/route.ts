import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

export const maxDuration = 60

const ALLOWED_ORIGINS = [
  'https://craftifyle.business',
  'https://www.craftifyle.business',
  'http://localhost:3000',
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

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

function getSystemPrompt(ai: AiProfile) {
  const dateStr = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const businessName = ai.business_name?.trim() || 'Craftifyle'
  const isCustomized = !!(ai.business_description?.trim() || ai.pricing_model?.trim())
  const tone = TONE_LABELS[ai.ai_tone ?? ''] ?? TONE_LABELS.casual_taglish

  const businessSection = isCustomized
    ? `ABOUT THIS BUSINESS:\n${ai.business_description}\n\nHOW WE PRICE:\n${ai.pricing_model}${ai.ai_context?.trim() ? `\n\nADDITIONAL CONTEXT:\n${ai.ai_context}` : ''}`
    : `ABOUT THIS BUSINESS:\nCraftifyle — photobooth and event photography in Zamboanda City, Philippines.\nPackages: Photobooth Only ₱3,500 · Photography Only ₱4,500 · Photobooth + Photography ₱6,500 · Premium Bundle ₱8,000.`

  const rulesSection = ai.ai_rules?.trim() ? `\nOWNER-DEFINED RULES:\n${ai.ai_rules}` : ''
  const pdfsSection = ai.ai_pdfs?.length
    ? `\nKNOWLEDGE BASE (from uploaded documents):\n${ai.ai_pdfs.map(p => `--- ${p.name} ---\n${p.text}`).join('\n\n')}`
    : ''

  return `You are Craft — a smart AI business advisor built into the ${businessName} CRM.

TODAY'S DATE: ${dateStr}.

${businessSection}
${rulesSection}

You help the business owner with:
- Advising how to handle client situations and negotiations
- Drafting client messages in the owner's voice
- Recommending how to price or position services
- General business strategy and operations advice

REPLY TONE: ${tone}
Keep answers short and practical — no fluff. If drafting a client message, write in the owner's voice.${pdfsSection}`
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured.' }, { status: 500, headers })
  }

  const { messages } = await req.json()
  if (!messages?.length) {
    return NextResponse.json({ error: 'No messages provided.' }, { status: 400, headers })
  }

  // Load AI profile if the request comes from an authenticated CRM session
  let aiProfile: AiProfile = {}
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('__session')?.value
    if (sessionCookie) {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
      const profileSnap = await adminDb.collection('profiles').doc(decoded.uid).get()
      if (profileSnap.exists) aiProfile = profileSnap.data() as AiProfile
    }
  } catch { /* unauthenticated call from portfolio website — use defaults */ }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: getSystemPrompt(aiProfile),
    })

    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(messages[messages.length - 1].content)
    const reply = result.response.text()
    return NextResponse.json({ reply }, { headers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500, headers })
  }
}
