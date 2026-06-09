/**
 * One-time script to import Supabase data-export JSON files into Firestore.
 * Run: npx ts-node --project tsconfig.json scripts/import-firebase.ts
 * Or:  npx tsx scripts/import-firebase.ts
 *
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local
 */

import * as admin from 'firebase-admin'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = admin.firestore()

const COLLECTIONS = [
  { file: 'leads.json',                  collection: 'leads' },
  { file: 'bookings.json',               collection: 'bookings' },
  { file: 'packages.json',               collection: 'packages' },
  { file: 'profiles.json',               collection: 'profiles' },
  { file: 'team_invites.json',           collection: 'team_invites' },
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

  // Batch writes in groups of 500 (Firestore limit)
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
    process.stdout.write(`Importing ${collection}...`)
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
