import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
// pdf-parse is CJS-only; require() is correct here
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

export const maxDuration = 60

const MAX_TEXT_CHARS = 40000

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('__session')?.value
    if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await adminAuth.verifySessionCookie(sessionCookie, true)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await pdfParse(buffer)
  const text = result.text.slice(0, MAX_TEXT_CHARS).trim()

  if (!text) return NextResponse.json({ error: 'Could not extract text from this PDF.' }, { status: 422 })

  return NextResponse.json({ text, name: file.name, truncated: result.text.length > MAX_TEXT_CHARS })
}
