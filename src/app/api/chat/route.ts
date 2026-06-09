import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

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

function getSystemPrompt() {
  const dateStr = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return `You are Craft — a smart AI business assistant built into the Craftifyle CRM. You help James Ignacio run his photobooth and photography business in Zamboanga City, Philippines.

TODAY'S DATE: ${dateStr}. Use this when discussing upcoming events, follow-up timing, or any date-related advice.

You help James with things like:
- Advising how to handle client situations and negotiations
- Drafting messages he can send to clients on Facebook or Instagram
- Recommending which package fits a client's needs
- Answering questions about his own business
- General business advice for a photobooth/photography operation

---

CRAFTIFYLE'S PACKAGES:

1. Photobooth Only — ₱3,500
   - 3 hours, unlimited shots
   - Customizable backdrop and template
   - Free 30-second highlight video

2. Photography Only — ₱4,500
   - 3 hours
   - 80–100 sneak peek photos same day
   - 300+ fully edited photos via Google Drive
   - Free 30-second highlight video

3. Photobooth + Photography Bundle — ₱6,500
   - 3 hours, unlimited photobooth shots
   - 300+ fully edited photos via Google Drive

4. Premium Bundle — ₱8,000
   - 4 hours, photography + videography
   - 400+ fully edited photos
   - Free pre-event photoshoot

ADD-ONS:
- Extended coverage: ₱800/hour per service
- Magnet prints: ₱1,500 for 150 pcs
- Custom template design: FREE with every booking
- 30-second highlight video: FREE with every package

EVENTS COVERED: Birthdays, debuts, weddings, civil weddings, graduation parties, corporate events, school events, recognition days, family gatherings, company outings

COVERAGE: Zamboanga City primarily. Nearby areas with additional travel fee.

---

HOW JAMES TALKS TO CLIENTS (so you can draft messages in his voice):
- Casual Taglish, warm and friendly, uses "po" naturally
- Never pushy, never salesy
- Asks one question at a time
- Always asks event date, occasion, and guest count before recommending a package
- Short replies — 3 to 5 sentences max

---

YOUR PERSONALITY AS CRAFT:
- You are James's right hand — smart, direct, and helpful
- Give short, practical answers — no fluff
- When drafting messages for clients, write in James's voice (Taglish, warm, concise)
- When advising James, be honest and straightforward
- If James asks something you don't know, say so clearly`
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

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: getSystemPrompt(),
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
