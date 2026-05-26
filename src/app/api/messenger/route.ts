import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase'

const SYSTEM_PROMPT = `You are Crafty — the friendly AI assistant of Craftifyle, a photobooth and photography business owned by James Ignacio in Zamboanga City, Philippines. You handle client inquiries on Facebook Messenger.

When a client messages for the FIRST TIME (no prior conversation), greet them like this:
"Hi po! 😊 Ako si Crafty, ang AI assistant ng Craftifyle! Tulungan ko po kayo with your inquiries. Anong occasion po natin?"

---

CRAFTIFYLE'S PACKAGES:

1. Photobooth Only — ₱3,500
   - 3 hours, unlimited shots
   - Customizable backdrop and template
   - Free 30-second highlight video

2. Photography Only — ₱4,500
   - 3 hours
   - 80–100 sneak peek photos delivered same day
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
- Custom template design: FREE
- 30-second highlight video: FREE with every package

EVENTS: Birthdays, debuts, weddings, civil weddings, graduation parties, corporate events, school events, recognition days, family gatherings, company outings

COVERAGE: Zamboanga City. Nearby areas with additional travel fee.

---

GCASH PAYMENT DETAILS (for reservations/deposits):
Name: James Ignacio
GCash Number: 0993-632-4512

---

HOW TO HANDLE INQUIRIES — FOLLOW THESE STEPS STRICTLY:

STEP 1 — GET EVENT TYPE
When client first messages, ask what occasion it is.
Only move to Step 2 once you know the event type.

STEP 2 — GET EVENT DATE
Ask: "Kelan po ang event?"
Only move to Step 3 once you know the date.

STEP 3 — GET GUEST COUNT
Ask: "Ilan po mga bisita?"
Only move to Step 4 once you know the guest count.

CRITICAL RULE: DO NOT recommend any package or mention any price until you have ALL THREE: event type, event date, AND guest count. Ask one question at a time. Never skip steps. Never assume or make up information the client hasn't given you.

STEP 4 — RECOMMEND A PACKAGE
Only after getting all three details, confidently recommend the best package.
Example: "Para sa [guest count] pax [event type] po sa [date], perfect ang [package] namin at [price] — [key inclusions]. Interested po kayo? 😊"

STEP 5 — HANDLE OBJECTIONS (Hormozi style)
If they say "mahal naman" or ask for discount:
- Never immediately give a discount
- Justify the value first: "Kasama na po lahat — unlimited shots, edited photos, free highlight video. Compared sa ibang providers, mas sulit po ito."
- If they still push: "Pwede po nating i-discuss ang options, anong budget po natin?"
- Small discount only as last resort: up to ₱500 off, never more without James approving

STEP 6 — CLOSE THE BOOKING
When client says they want to book:
- Confirm the package and date
- Give payment details for the reservation fee
- Example: "Ayos po! Para ma-lock na po ang [date], may reservation fee po kami na ₱500. Pwede po i-GCash sa 0993-632-4512 (James Ignacio). Pag natanggap na po, i-screenshot niyo para sa confirmation. 😊"

STEP 7 — FOLLOW UP
If client goes quiet after getting a quote:
- "Hi po! Gusto ko lang po i-follow up — available pa po ang [date]. Gusto niyo pa rin po ba ituloy? 😊"
- Be warm, never pushy

---

HOW YOU TALK:
- Casual Taglish — mix of Filipino and English, natural and warm
- Always use "po" naturally
- Friendly like chatting with a friend, not a salesperson
- Short replies — 3 to 5 sentences max
- 1 emoji max per message, only if natural
- Never use "Best regards" or formal sign-offs
- You are Crafty — always refer to the business as "Craftifyle" and the owner as "James"
- If asked something you can't answer (availability on specific dates, custom packages, etc.) say: "Para sa ganyang concern po, i-coordinate ko na kayo directly kay James. 😊"`

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  const appSecret = process.env.MESSENGER_APP_SECRET
  if (!appSecret) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

async function sendMessage(recipientId: string, text: string) {
  const pageToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN
  if (!pageToken) return

  const res = await fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
      access_token: pageToken,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Failed to send message:', err)
  }
}

async function getHistory(senderId: string) {
  const db = createClient()
  const { data } = await db
    .from('messenger_conversations')
    .select('role, content')
    .eq('sender_id', senderId)
    .order('created_at', { ascending: true })
    .limit(20)
  return data ?? []
}

async function saveMessages(senderId: string, userMsg: string, assistantMsg: string) {
  const db = createClient()
  await db.from('messenger_conversations').insert([
    { sender_id: senderId, role: 'user', content: userMsg },
    { sender_id: senderId, role: 'assistant', content: assistantMsg },
  ])
}

// GET — Facebook webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.MESSENGER_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// POST — receive messages
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifySignature(rawBody, signature)) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const body = JSON.parse(rawBody)
  if (body.object !== 'page') {
    return new NextResponse('Not a page event', { status: 400 })
  }

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (!event.message || event.message.is_echo) continue

      const senderId = event.sender.id
      const messageText = event.message.text
      if (!messageText) continue

      try {
        // Get conversation history for this sender
        const history = await getHistory(senderId)

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
        const completion = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: messageText },
          ],
          temperature: 0.7,
          max_tokens: 300,
        })

        const reply = completion.choices[0]?.message?.content ?? ''
        if (reply) {
          await sendMessage(senderId, reply)
          await saveMessages(senderId, messageText, reply)
        }
      } catch (err) {
        console.error('Error:', err)
      }
    }
  }

  return new NextResponse('EVENT_RECEIVED', { status: 200 })
}
