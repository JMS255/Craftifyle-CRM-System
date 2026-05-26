import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are James Ignacio, owner of Craftifyle — a photobooth and photography business based in Zamboanga City, Philippines. You are replying to potential clients on Facebook Messenger or Instagram DMs.

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
Primarily Zamboanda City. Nearby areas are available with an additional travel fee depending on the distance.

---

HOW YOU TALK TO CLIENTS:

- Casual Taglish — mix of Filipino and English, natural and warm
- Always use "po" naturally, not forced
- Warm and friendly, like chatting with a friend, not a salesperson
- NEVER be pushy or pressure them to book
- Ask only ONE question at a time — never bombard them with multiple questions
- ALWAYS qualify before quoting a package — ask about their event date, occasion type, and guest count first before recommending or quoting a specific package
- If they ask "magkano?" without giving event details, ask about their event first before giving prices
- If they already gave enough details (date, event type, guest count), then you can recommend a package and give the price
- Confident but never salesy
- Keep replies short — 3 to 5 sentences max. No long paragraphs
- Use 1 emoji max per message, only if it feels natural
- Never use generic sign-offs like "Best regards" or "Sincerely"`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || apiKey === 'paste-your-groq-api-key-here') {
    return NextResponse.json(
      { error: 'Groq API key not configured. Add GROQ_API_KEY to .env.local and restart the server.' },
      { status: 500 }
    )
  }

  const { clientMessage, leadContext } = await req.json()

  if (!clientMessage?.trim()) {
    return NextResponse.json({ error: 'Client message is required.' }, { status: 400 })
  }

  const contextLines: string[] = []
  if (leadContext?.name) contextLines.push(`Client name: ${leadContext.name}`)
  if (leadContext?.event_type) contextLines.push(`Event type: ${leadContext.event_type.replace('_', ' ')}`)
  if (leadContext?.event_date) contextLines.push(`Event date: ${leadContext.event_date}`)
  if (leadContext?.venue) contextLines.push(`Venue: ${leadContext.venue}`)
  if (leadContext?.guest_count) contextLines.push(`Guest count: ${leadContext.guest_count}`)
  if (leadContext?.package) contextLines.push(`Package they mentioned: ${leadContext.package}`)
  if (leadContext?.budget) contextLines.push(`Budget they mentioned: ₱${leadContext.budget}`)

  const contextBlock = contextLines.length > 0
    ? `\n\nWhat we know about this client:\n${contextLines.join('\n')}`
    : ''

  const userPrompt = `${contextBlock}\n\nThe client sent this message:\n"${clientMessage}"\n\nWrite a reply from James (Craftifyle) to this client.`

  try {
    const groq = new Groq({ apiKey })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    })

    const reply = completion.choices[0]?.message?.content ?? ''
    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Groq error: ${message}` }, { status: 500 })
  }
}
