/**
 * One-time script: reassign all documents from old Supabase UID to new Firebase UID.
 * Run: npx tsx scripts/migrate-uid.ts
 */

import * as fs from 'fs'
import * as path from 'path'

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

const OLD_UID = 'd0d322e9-dbd0-411c-9092-ba46b18195b4'
const NEW_UID = 'WMVaPaBWqBhBWP4YXByQ3N2lN6O2'

const COLLECTIONS = ['leads', 'bookings', 'packages', 'team_invites', 'messenger_conversations']

async function migrateCollection(collection: string) {
  const snap = await db.collection(collection).where('user_id', '==', OLD_UID).get()
  if (snap.empty) {
    console.log(`  ${collection}: 0 docs to update`)
    return
  }

  const batch = db.batch()
  snap.docs.forEach(doc => batch.update(doc.ref, { user_id: NEW_UID }))
  await batch.commit()
  console.log(`  ${collection}: ${snap.size} docs updated`)
}

async function migrateProfile() {
  const snap = await db.collection('profiles').doc(OLD_UID).get()
  if (!snap.exists) {
    console.log('  profiles: old doc not found')
    return
  }
  const data = snap.data()!
  await db.collection('profiles').doc(NEW_UID).set(data)
  await db.collection('profiles').doc(OLD_UID).delete()
  console.log('  profiles: moved doc from old UID to new UID')
}

async function main() {
  console.log(`Migrating UID\n  from: ${OLD_UID}\n  to:   ${NEW_UID}\n`)
  for (const col of COLLECTIONS) {
    process.stdout.write(`Updating ${col}... `)
    await migrateCollection(col)
  }
  process.stdout.write('Updating profiles... ')
  await migrateProfile()
  console.log('\nDone!')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
