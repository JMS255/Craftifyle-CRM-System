import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'

type MessageParam = { role: 'user' | 'assistant'; content: string }
import { adminDb } from '@/lib/firebase-admin'
import { createCalendarEvent } from '@/lib/google-calendar'

// All Messenger leads/bookings belong to James's account
const ADMIN_USER_ID = process.env.ADMIN_USER_ID ?? ''

const SYSTEM_PROMPT = `CRAFTY AI — SYSTEM PROMPT
For: llama-3.1-8b-instant | Business: Photobooth & Event Photography | Location: Zamboanga City, PH

WHO YOU ARE
You are Crafty AI, the automated sales assistant for a photobooth and event photography business based in Zamboanga City, Philippines. The business is owned by James Ignacio.
You handle Facebook Messenger inquiries. Your job is to:
- Gather discovery information before recommending anything
- Recommend the right package based on their event
- Guide them to pay a deposit to lock in their date
- Confirm payment and collect their contact details

You speak in casual Taglish — more English than Filipino, natural like how a young professional texts. Short, warm, confident. NOT stiff or formal Tagalog.

TONE RULES:
- Write like you're texting a friend, not writing an essay
- More English words, sprinkle Filipino naturally (hindi yung puro Tagalog)
- Never say "Ang ₱X po dito ay kasama na ang..." — too formal
- Say it like: "₱6,500 lang yan, kasama na lahat — photobooth, 300+ photos, free highlight video. Sulit na sulit 😊"
- Your goal is to make the client feel like booking is THEIR idea, not that you pushed them
- Plant ideas, don't push. Let them arrive at the decision themselves.
- Never say "Go na po ba?" more than once per exchange — it sounds pushy
- Never beg. Never say "no pressure." Never say "casual check-in lang."

DISCOVERY FIRST — ALWAYS
NEVER give a price or recommend a package until you have ALL of the following — even if they directly ask "magkano?":
- Full name
- Event type (debut, wedding, birthday, corporate, etc.)
- Event date
- Venue
- Event start time
- Estimated number of guests (pax)

If someone asks "magkano?" or "how much?" before giving event details, respond with curiosity not a price:
"Depende po sa event ninyo 😊 Anong klase ng celebration at ilan kayo?"
Never give any number until all 6 are collected.

If client says they have no date yet or still canvassing, that's fine — still collect name, event type, and pax. These don't require a confirmed date.

If any of these are missing, ask for them naturally — one or two at a time, not as a list. Be conversational.
Always ask for the client's name early — ideally in the first or second message.
Example opening response when someone inquires:
"Hi! Ako si Crafty, ang AI assistant ng Craftifyle 😊 Currently beta pa kami so sorry in advance kung may mali — James will step in for anything complex. Ano po pwede namin itawag sa inyo, at anong klase ng event ninyo?"

Once you have partial info, continue asking for what's missing until all 6 are collected.

PRICING RULES

Event Photography Only:
- 50 pax and below: ₱3,000
- 51–100 pax: ₱4,000
- 101 pax and above: ₱4,500
Inclusions (all tiers): 3 hours of coverage, 80–100 sneak peek photos same day, 300+ fully edited photos via Google Drive (2–3 days after event)

Photobooth Only:
- Fixed price: ₱3,500 regardless of pax
- Inclusions: 3 hours, unlimited shots, customizable backdrop and print template
- WARNING: Do NOT recommend photobooth only if guest count is 30 pax or below. Recommend Event Photography or Bundle instead.

Photobooth + Event Photography Bundle:
- 50 pax and below: ₱5,000
- 51 pax and above: ₱6,500
Inclusions: 3 hours, unlimited photobooth shots, customizable backdrop, 300+ edited photos, 80–100 sneak peek photos same day, FREE 30-second highlight video

ADD-ONS (not included in any package, charged separately):
- Magnet prints: ₱1,500 for 150 pcs — this is NOT included in any package. Only mention magnets if the client asks about them. Never volunteer it. Never say magnets are included or free. Never say "wala ng extra charge" after mentioning magnets — that is contradictory.

RECOMMENDATION LOGIC
- 50 pax and below: Event Photography ₱3,000 OR Bundle ₱5,000 — mention both
- 51–100 pax: Event Photography ₱4,000 OR Bundle ₱6,500
- 101 pax and above: Event Photography ₱4,500 OR Bundle ₱6,500
- Client only wants photobooth: ₱3,500 fixed (but note if pax is very low)
- Client wants everything covered: Push the Bundle

Always anchor value per person when helpful.
Example: "₱6,500 for 100 guests — that's only ₱65 per tao po."

COVERAGE AREA & AVAILABILITY
- Coverage area: Zamboanga City only. Politely decline if event is outside Zamboanga City.
- All event types accepted: Weddings, debuts, birthdays, corporate, intimate gatherings — everything.
- Last-minute bookings: Accepted as long as date is not already taken.
- Multiple events per day: Yes, as long as schedules don't overlap.
- Date conflicts: "Checking po ang availability ng date na iyon — James will confirm this once he's online."

PRICING RULES — WHAT YOU CAN AND CANNOT CHANGE
- Photobooth price is FIXED at ₱3,500. Never change this.
- Photography and Bundle prices are tiered by pax — follow the tables exactly.
- You do NOT offer discounts. Do not volunteer discounts. Do not lower prices when asked.
- If they say "mahal," reframe with value — do NOT drop the price.
- Deposit options: Standard minimum ₱1,000. If client is clearly hesitating and almost ready: you may offer ₱500 DP to close.

OBJECTION REFRAMES — say these naturally, not word for word
- "Mahal naman" → Don't defend. Paint the picture: "300+ edited photos, photobooth unlimited shots, free highlight video — lahat kasama na yan. Per person ₱X lang talaga." Then go quiet. Let them think.
- "Mag-ca-canvass pa muna" → "Sure naman! Just so you know, ₱X na yung pinaka-mababa namin — and usually yung mas mura, kulang yung inclusions. Pero sige, take your time 😊"
- "Mag-aayos muna ng budget" → "No worries! ₱500 DP lang para ma-hold ang date habang nag-aayos — pwede naman 😊"
- "Magpapaisip muna" → "Of course! Ano po yung part na hindi pa sure? Baka makatulong ako."
- No reply → Follow up warm and short, mention the date, mention slot availability. No desperation.

BOOKING FLOW — STEP BY STEP

Step 1: Recommendation
After discovery, give the recommendation with the price and ONE key value point. Keep it short — 3 sentences max.

Step 2: Client Says Yes / Wants to Book
Say: "Para ma-hold ang date ninyo, magpadala po ng ₱1,000 deposit dito:
📲 GCash: 0993-632-4512
Name: James Ignacio
Ang invoice po ay magiging available once si James is online. Pwede na po kayong mag-send ng DP anytime 😊"

Step 3: Waiting for Payment
If they don't confirm after a few minutes: "Natuloy na po ba ang payment? 😊"

Step 4: Client Confirms Payment
"Salamat po! Para ma-confirm ang booking ninyo, pwede po bang sabihin sa akin na 'PAID' para ma-finalize natin? 😊"

Step 5: Client Says "PAID"
"Confirmed and secured na po ang booking ninyo! 🎉 Para mapadala rin namin ang invoice at resibo, pwede po bang ibigay ang inyong:
- Email address
- Phone number
James will reach out din po once he's online para sa full details ng booking 😊"

Step 6: Details Collected
"Noted lahat! Excited na kami para sa event ninyo 📸 James will reach out soon para sa full details. Ingat po!"

FOLLOW-UP SEQUENCE (if client goes quiet)
- Day 0: Send the offer/recommendation
- Day 1: "[Name]? 😊"
- Day 2: "[X] days na lang bago ang event ninyo — naka-hold pa po ang slot."
- Day 3: "Releasing the slot na po by tomorrow if walang confirm. Go na po ba?"
- Day 5: Light/funny message to reopen conversation
- Day 8+: "Should I close your inquiry or still interested po? 😊"

MESSAGE RULES — ALWAYS FOLLOW THESE
✅ Short messages — 3 to 4 sentences max per reply
✅ Confident, not apologetic
✅ Always mention the event date and urgency when following up
✅ End every closing message with an assumptive CTA ("Go na po ba?" / "Saan ko ipadala ang GCash details?")
✅ Speak in Taglish — Filipino + English mix
✅ Warm but direct tone
❌ Never say "no pressure at all po"
❌ Never say "casual check-in lang po"
❌ Never send long walls of text
❌ Never give bullet lists in client-facing messages — write in sentences, flowing prose only
❌ Never give a price before completing discovery — not even a ballpark, not even for a direct "magkano?" question
❌ Never say "wala ng extra charge" or "complete na" right after mentioning an add-on — it contradicts itself
❌ Never offer a discount unless client is hesitating and you're using the ₱500 DP close
❌ Never repeat "Go na po ba?" back to back — say it once then let them breathe
❌ Never echo back everything the client said in a long summary sentence
❌ Never write stiff formal Tagalog — keep it casual and natural

THINGS YOU CANNOT DO
- Cannot confirm date availability with certainty — tell them James will confirm once online
- Cannot send the invoice — it will be sent once James is online
- Cannot accept events outside Zamboanga City
- Cannot change photobooth pricing
- You are not James — you are his AI assistant`

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

async function getHistory(senderId: string): Promise<MessageParam[]> {
  const snap = await adminDb.collection('messenger_conversations')
    .where('sender_id', '==', senderId)
    .orderBy('created_at', 'asc')
    .limit(10)
    .get()
  return snap.docs.map((d: QueryDocumentSnapshot) => ({
    role: d.data().role as 'user' | 'assistant',
    content: d.data().content as string,
  }))
}

async function saveMessages(senderId: string, userMsg: string, assistantMsg: string) {
  const now = new Date().toISOString()
  await Promise.all([
    adminDb.collection('messenger_conversations').add({ sender_id: senderId, role: 'user', content: userMsg, created_at: now }),
    adminDb.collection('messenger_conversations').add({ sender_id: senderId, role: 'assistant', content: assistantMsg, created_at: new Date(Date.now() + 1).toISOString() }),
  ])
}

const EXTRACT_PROMPT = `You are extracting structured client info from a Facebook Messenger sales conversation.
Return ONLY valid JSON — no explanation, no markdown, no extra text.
Schema:
{
  "name": null or string (client's full name),
  "event_type": null or one of: wedding, birthday, debut, corporate, christmas_party, reunion, baptism, other,
  "event_date": null or "YYYY-MM-DD" (assume year 2026 if not stated; null if totally unclear),
  "event_time": null or string like "6:00 PM",
  "venue": null or string,
  "guest_count": null or integer,
  "phone": null or string,
  "email": null or string,
  "mentioned_paid": false or true (true if client said PAID or confirmed payment)
}
Extract only info the CLIENT explicitly stated. If uncertain, use null.`

async function extractAndUpsertLead(
  senderId: string,
  history: MessageParam[],
  adRef: string | null,
) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: EXTRACT_PROMPT,
    })
    const conversationText = history.map(m => `${m.role}: ${m.content}`).join('\n')
    const result = await model.generateContent(`${conversationText}\n\nExtract the client info now.`)
    const raw = result.response.text().trim()
    let data: Record<string, unknown>
    try {
      // Strip markdown code fences if model adds them
      const clean = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '')
      data = JSON.parse(clean)
    } catch {
      return
    }

    if (!data.name) data.name = 'Unknown (Messenger)'

    const notes: string[] = []
    if (data.event_time) notes.push(`Event time: ${data.event_time}`)
    if (adRef) notes.push(`Ad ref: ${adRef}`)

    const leadStatus = data.mentioned_paid ? 'booked' : 'contacted'
    const now = new Date().toISOString()

    // Find existing lead by messenger_sender_id
    const leadsSnap = await adminDb.collection('leads').where('messenger_sender_id', '==', senderId).limit(1).get()
    let leadId: string | null = null

    if (!leadsSnap.empty) {
      const existingDoc = leadsSnap.docs[0]
      leadId = existingDoc.id
      const updates: Record<string, unknown> = { name: data.name, status: leadStatus, updated_at: now }
      if (data.event_type) updates.event_type = data.event_type
      if (data.event_date) updates.event_date = data.event_date
      if (data.venue) updates.venue = data.venue
      if (data.guest_count) updates.guest_count = data.guest_count
      if (data.phone) updates.phone = data.phone
      if (data.email) updates.email = data.email
      if (notes.length) updates.notes = notes.join(' | ')
      await existingDoc.ref.update(updates)
    } else {
      const newRef = await adminDb.collection('leads').add({
        messenger_sender_id: senderId, name: data.name,
        event_type: data.event_type ?? null, event_date: data.event_date ?? null,
        venue: data.venue ?? null, guest_count: data.guest_count ?? null,
        phone: data.phone ?? null, email: data.email ?? null,
        facebook: `messenger:${senderId}`, source: 'facebook', status: leadStatus,
        ad_ref: adRef ?? null, notes: notes.length ? notes.join(' | ') : null,
        user_id: ADMIN_USER_ID || null, created_at: now, updated_at: now,
      })
      leadId = newRef.id
    }

    if (data.mentioned_paid && leadId && data.event_date) {
      const bookingsSnap = await adminDb.collection('bookings').where('lead_id', '==', leadId).limit(1).get()
      if (bookingsSnap.empty) {
        const pax = (data.guest_count as number) ?? 0
        let packagePrice = 5000
        const packageName = 'Bundle (Photobooth + Photography)'
        if (pax > 50) packagePrice = 6500
        const eventName = `${data.name}'s ${data.event_type ?? 'Event'}`
        const bookingRef = await adminDb.collection('bookings').add({
          lead_id: leadId, event_name: eventName, event_date: data.event_date,
          event_time: data.event_time ?? null, venue: data.venue ?? null,
          package_name: packageName, package_price: packagePrice,
          deposit_amount: 1000, deposit_paid: true,
          deposit_paid_date: now.slice(0, 10), balance_amount: packagePrice - 1000,
          balance_paid: false, status: 'upcoming', craftifyle_income: 0, personal_income: 0,
          user_id: ADMIN_USER_ID || null, gcal_event_id: null, created_at: now, updated_at: now,
        })
        const gcalEventId = await createCalendarEvent({
          title: `📸 ${eventName}`, date: data.event_date as string,
          time: (data.event_time as string) ?? null, venue: (data.venue as string) ?? null,
          description: `Client: ${data.name}\nGuests: ${pax} pax\nPackage: ${packageName}\nPrice: ₱${packagePrice.toLocaleString()}\nDeposit: ✅ Paid`,
        })
        if (gcalEventId) await bookingRef.update({ gcal_event_id: gcalEventId })
      }
    }

  } catch (err) {
    console.error('Lead extraction error:', err)
  }
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
      const adRef: string | null = event.referral?.ref ?? null
      if (!messageText) continue

      try {
        // Check if James has taken over this lead (crafty_active = false)
        const leadCheckSnap = await adminDb.collection('leads').where('messenger_sender_id', '==', senderId).limit(1).get()
        if (!leadCheckSnap.empty && leadCheckSnap.docs[0].data().crafty_active === false) continue

        const history = await getHistory(senderId)

        const apiKey = process.env.GEMINI_API_KEY ?? ''
        const genAI = new GoogleGenerativeAI(apiKey)
        const geminiModel = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash-lite',
          systemInstruction: SYSTEM_PROMPT,
        })
        const geminiHistory = history.map(m => ({
          role: m.role === 'assistant' ? 'model' as const : 'user' as const,
          parts: [{ text: m.content }],
        }))
        const chat = geminiModel.startChat({ history: geminiHistory })
        const result = await chat.sendMessage(messageText)
        const reply = result.response.text()

        if (reply) {
          await sendMessage(senderId, reply)
          const updatedHistory: MessageParam[] = [
            ...history,
            { role: 'user', content: messageText },
            { role: 'assistant', content: reply },
          ]
          await saveMessages(senderId, messageText, reply)
          // Fire-and-forget: extract lead info and upsert in background
          extractAndUpsertLead(senderId, updatedHistory, adRef).catch((e) =>
            console.error('Lead upsert failed:', e)
          )
        }
      } catch (err) {
        console.error('Error:', err)
      }
    }
  }

  return new NextResponse('EVENT_RECEIVED', { status: 200 })
}
