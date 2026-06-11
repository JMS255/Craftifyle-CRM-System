import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
const lines = fs.readFileSync(envPath, 'utf8').split('\n')
for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
  if (key && !(key in process.env)) process.env[key] = val
}

const raw = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? ''
const b64 = Buffer.from(raw).toString('base64')
console.log('\nPaste this as FIREBASE_PRIVATE_KEY in Vercel:\n')
console.log(b64)
console.log()
