/**
 * One-time script to import Supabase data-export JSON files into Firestore.
 * Run: npx tsx scripts/import-firebase.ts
 *
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local
 */

import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually — no dotenv dependency needed
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
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
}

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()

const COLLECTIONS = [
  { file: 'leads.json',                   collection: 'leads' },
  { file: 'bookings.json',                collection: 'bookings' },
  { file: 'packages.json',                collection: 'packages' },
  { file: 'profiles.json',                collection: 'profiles' },
  { file: 'team_invites.json',            collection: 'team_invites' },
  { file: 'messenger_conversations.json', collection: 'messenger_conversations' },
]

async function importCollection(file: string, collection: string) {
  const filePath = path.join(process.cwd(), 'data-export', file)
  if (!fs.existsSync(filePath)) {
    console.log(`  Skipping ${file} — not found`)
    return
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const records: Record<string, unknown>[] = JSON.parse(raw)

  if (!records.length) {
    console.log(`  ${collection}: 0 records`)
    return
  }

  let written = 0
  for (let i = 0; i < records.length; i += 500) {
    const batch = db.batch()
    const chunk = records.slice(i, i + 500)
    for (const record of chunk) {
      const id = String(record.id ?? '')
      const { id: _id, ...data } = record
      const ref = id ? db.collection(collection).doc(id) : db.collection(collection).doc()
      batch.set(ref, data)
    }
    await batch.commit()
    written += chunk.length
  }

  console.log(`  ${collection}: ${written} records imported`)
}

async function main() {
  console.log('Starting Firestore import...\n')
  for (const { file, collection } of COLLECTIONS) {
    process.stdout.write(`Importing ${collection}... `)
    try {
      await importCollection(file, collection)
    } catch (err) {
      console.error(`\n  ERROR importing ${collection}:`, err)
    }
  }
  console.log('\nDone!')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
