import { google } from 'googleapis'

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? 'craftifylephotobooth@gmail.com'

function getCalendarClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  return google.calendar({ version: 'v3', auth })
}

export async function createCalendarEvent({
  title,
  date,
  time,
  venue,
  description,
}: {
  title: string
  date: string        // YYYY-MM-DD
  time?: string | null // HH:MM or "6:00 PM"
  venue?: string | null
  description?: string
}): Promise<string | null> {
  try {
    const calendar = getCalendarClient()

    // Parse start time
    let startDateTime: string
    let endDateTime: string

    if (time) {
      // Convert "6:00 PM" style or "18:00" to full datetime
      const timeParsed = parseTime(time)
      startDateTime = `${date}T${timeParsed}`
      // Default 4 hour event
      const endHour = parseInt(timeParsed.split(':')[0]) + 4
      endDateTime = `${date}T${String(endHour).padStart(2, '0')}:${timeParsed.split(':')[1]}:00`
    } else {
      // All day event
      startDateTime = date
      endDateTime = date
    }

    const event = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: title,
        location: venue ?? undefined,
        description: description ?? undefined,
        start: time
          ? { dateTime: startDateTime, timeZone: 'Asia/Manila' }
          : { date: startDateTime },
        end: time
          ? { dateTime: endDateTime, timeZone: 'Asia/Manila' }
          : { date: endDateTime },
        colorId: '2', // Green = confirmed booking
      },
    })

    return event.data.id ?? null
  } catch (err) {
    console.error('Google Calendar create error:', err)
    return null
  }
}

export async function updateCalendarEvent({
  eventId,
  title,
  date,
  time,
  venue,
  description,
  cancelled,
}: {
  eventId: string
  title: string
  date: string
  time?: string | null
  venue?: string | null
  description?: string
  cancelled?: boolean
}): Promise<void> {
  try {
    const calendar = getCalendarClient()

    if (cancelled) {
      await calendar.events.delete({
        calendarId: CALENDAR_ID,
        eventId,
      })
      return
    }

    let startDateTime: string
    let endDateTime: string

    if (time) {
      const timeParsed = parseTime(time)
      startDateTime = `${date}T${timeParsed}`
      const endHour = parseInt(timeParsed.split(':')[0]) + 4
      endDateTime = `${date}T${String(endHour).padStart(2, '0')}:${timeParsed.split(':')[1]}:00`
    } else {
      startDateTime = date
      endDateTime = date
    }

    await calendar.events.update({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: {
        summary: title,
        location: venue ?? undefined,
        description: description ?? undefined,
        start: time
          ? { dateTime: startDateTime, timeZone: 'Asia/Manila' }
          : { date: startDateTime },
        end: time
          ? { dateTime: endDateTime, timeZone: 'Asia/Manila' }
          : { date: endDateTime },
      },
    })
  } catch (err) {
    console.error('Google Calendar update error:', err)
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    const calendar = getCalendarClient()
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
    })
  } catch (err) {
    console.error('Google Calendar delete error:', err)
  }
}

// Parse "6:00 PM" or "18:00" → "18:00:00"
function parseTime(time: string): string {
  time = time.trim()
  const pmMatch = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (pmMatch) {
    let hour = parseInt(pmMatch[1])
    const min = pmMatch[2]
    const period = pmMatch[3].toUpperCase()
    if (period === 'PM' && hour !== 12) hour += 12
    if (period === 'AM' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${min}:00`
  }
  // Already in HH:MM format
  const simple = time.match(/^(\d{1,2}):(\d{2})$/)
  if (simple) return `${simple[1].padStart(2, '0')}:${simple[2]}:00`
  return '09:00:00'
}
