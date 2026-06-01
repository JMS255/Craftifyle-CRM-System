import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // If no INVITE_CODE env var is set, open beta — anyone can sign up
  if (!process.env.INVITE_CODE) return NextResponse.json({ ok: true })
  const { code } = await req.json()
  const valid = code === process.env.INVITE_CODE
  return valid
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Invalid code' }, { status: 401 })
}
