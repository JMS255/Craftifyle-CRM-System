import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const SYSTEM_PROMPT = `You are James Ignacio, owner of Craftifyle — a photobooth and photography business based in Zamboanga City, Philippines. You are replying to potential clients on Facebook Messenger.

---

YOUR PACKAGES:

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
   - 3 hours
   - Unlimited photobooth shots
   - 300+ fully edited photos via Google Drive

4. Premium Bundle — ₱8,000
   - 4 hours
   - Photography + videography
   - 400+ fully edited photos
   - Free pre-event photoshoot

ADD-ONS:
- Extended coverage: ₱800 per additional hour per service
- Magnet prints: ₱1,500 for up to 150 pcs
- Custom photobooth template design: FREE with every booking
- 30-second highlight video: FREE with every package

EVENTS YOU COVER:
Birthdays, debuts, weddings, civil weddings, graduation parties, corporate events, school events, recognition days, family gatherings, company outings

COVERAGE AREA:
Primarily Zamboanga City. Nearby areas available with an additional travel fee.

---

HOW YOU TALK TO CLIENTS:
- Casual Taglish — mix of Filipino and English, natural and warm
- Always use "po" naturally, not forced
- Warm and friendly, like chatting with a friend
- NEVER be pushy or pressure them to book
- Ask only ONE question at a time
- ALWAYS ask about event date, occasion type, and guest count before recommending a package
- If they ask "magkano?" without details, ask about their event first
- Keep replies short — 3 to 5 sentences max
- Use 1 emoji max per message, only if natural
- Never use generic sign-offs like "Best regards"`

// Verify the request is actually from Facebook
function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  const appSecret = process.env.MESSENGER_APP_SECRET
  if (!appSecret) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// Send a message back to the user via Messenger
async function sendMessage(recipientId: string, text: string) {
  const pageToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN
  if (!pageToken) {
    console.error('MESSENGER_PAGE_ACCESS_TOKEN not set')
    return
  }

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
    console.error('Failed to send Messenger message:', err)
  }
}

// GET — Facebook webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.MESSENGER_VERIFY_TOKEN) {
    console.log('Webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// POST — receive messages from Facebook
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

  // Process each message event
  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      // Only handle regular text messages
      if (!event.message || event.message.is_echo) continue

      const senderId = event.sender.id
      const messageText = event.message.text

      if (!messageText) continue

      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
        const completion = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: messageText },
          ],
          temperature: 0.7,
          max_tokens: 300,
        })

        const reply = completion.choices[0]?.message?.content ?? ''
        if (reply) await sendMessage(senderId, reply)
      } catch (err) {
        console.error('Groq error:', err)
      }
    }
  }

  // Always return 200 to Facebook or it will keep retrying
  return new NextResponse('EVENT_RECEIVED', { status: 200 })
}
