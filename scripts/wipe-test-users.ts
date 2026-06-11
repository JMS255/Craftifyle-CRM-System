/**
 * One-time script: delete all data belonging to test/beta users.
 * Run: npx tsx scripts/wipe-test-users.ts
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

const TEST_UIDS = [
  '47079ffe-12e7-45ea-9eb4-576f4053bc0a', // Maria Santos
  'fac048cd-8bf2-40c3-b050-ae01ef46d100', // Roy Lorenz
  '22af99cb-8dc5-40c3-a92f-fc1e5995a60e', // duplicate James profile (Crafty CRM)
]

const COLLECTIONS = ['leads', 'bookings', 'packages', 'team_invites', 'messenger_conversations']

async function wipeCollection(collection: string, uid: string) {
  const snap = await db.collection(collection).where('user_id', '==', uid).get()
  if (snap.empty) return 0
  const batch = db.batch()
  snap.docs.forEach(doc => batch.delete(doc.ref))
  await batch.commit()
  return snap.size
}

async function main() {
  console.log('Wiping test user data...\n')

  for (const uid of TEST_UIDS) {
    console.log(`UID: ${uid}`)
    for (const col of COLLECTIONS) {
      const count = await wipeCollection(col, uid)
      if (count > 0) console.log(`  ${col}: deleted ${count} docs`)
    }
    // Delete profile doc
    const profileRef = db.collection('profiles').doc(uid)
    const profileSnap = await profileRef.get()
    if (profileSnap.exists) {
      await profileRef.delete()
      console.log(`  profiles: deleted`)
    }
    console.log()
  }

  console.log('Done!')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
