import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { code } = await req.json()
  const valid = code === process.env.INVITE_CODE
  return valid
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Invalid code' }, { status: 401 })
}
