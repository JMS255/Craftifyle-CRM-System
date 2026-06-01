import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

async function sendSms(phone: string, text: string) {
  const apiKey = process.env.SEMAPHORE_API_KEY
  if (!apiKey) return
  // Normalize PH number: strip spaces/dashes, ensure starts with 09 or +63
  const normalized = phone.replace(/[\s\-()]/g, '')
  const number = normalized.startsWith('0') ? '63' + normalized.slice(1) : normalized.replace(/^\+/, '')
  await fetch('https://api.semaphore.co/api/v4/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: apiKey, number, message: text, sendername: 'Craftifyle' }),
  })
}

async function sendMessage(recipientId: string, text: string) {
  const pageToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN
  if (!pageToken) return
  await fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'MESSAGE_TAG',
      tag: 'CONFIRMED_EVENT_UPDATE',
      access_token: pageToken,
    }),
  })
}

// Follow-up messages by days since last contact
function getFollowUpMessage(name: string, daysQuiet: number, eventDate: string | null): string {
  const firstName = name.split(' ')[0]
  const eventStr = eventDate
    ? new Date(eventDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })
    : null

  if (daysQuiet === 1) return `${firstName}? 😊`
  if (daysQuiet === 2) return eventStr
    ? `${eventStr} is coming up — naka-hold pa po ang slot ninyo 😊`
    : `How's it going po? Still interested? 😊`
  if (daysQuiet === 3) return `Releasing the slot na po by tomorrow if walang confirm. Go na po ba? 😊`
  if (daysQuiet <= 5) return `Hey ${firstName}! Just checking — still open to chatting about your event? 📸`
  return `Should I close your inquiry or still interested po? 😊`
}

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const db = createClient()
  const now = new Date()

  // Find leads that are active (contacted/quoted), have Messenger, Crafty is on,
  // and haven't had a follow-up in 24+ hours
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: leads } = await db
    .from('leads')
    .select('id, name, phone, event_date, messenger_sender_id, last_followup_sent, created_at')
    .in('status', ['contacted', 'quoted', 'negotiating'])
    .or(`last_followup_sent.is.null,last_followup_sent.lt.${oneDayAgo}`)

  let sent = 0

  for (const lead of leads ?? []) {
    const createdAt = new Date(lead.created_at)
    const daysQuiet = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    if (daysQuiet > 10) continue

    const message = getFollowUpMessage(lead.name, daysQuiet, lead.event_date)
    let didSend = false

    // Messenger follow-up (existing — only if Crafty active + has Messenger)
    if (lead.messenger_sender_id) {
      try {
        await sendMessage(lead.messenger_sender_id, message)
        didSend = true
      } catch (e) {
        console.error(`Messenger follow-up failed for lead ${lead.id}:`, e)
      }
    }

    // SMS follow-up — for leads with a phone number and no Messenger (or as backup)
    if (!didSend && lead.phone) {
      const firstName = lead.name.split(' ')[0]
      const smsText = `Hi ${firstName}! Baka nalimutan lang. Available pa kami para sa iyong event. Interested ka pa po ba? — Craftifyle 📸`
      try {
        await sendSms(lead.phone, smsText)
        didSend = true
      } catch (e) {
        console.error(`SMS follow-up failed for lead ${lead.id}:`, e)
      }
    }

    if (didSend) {
      await db.from('leads').update({ last_followup_sent: now.toISOString() }).eq('id', lead.id)
      sent++
    }
  }

  return NextResponse.json({ ok: true, sent })
}
