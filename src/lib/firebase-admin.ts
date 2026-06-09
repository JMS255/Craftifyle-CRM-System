import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'

function privateKey(): string {
  const k = process.env.FIREBASE_PRIVATE_KEY ?? ''
  if (k.startsWith('-----')) return k
  if (k.includes('\\n')) return k.replace(/\\n/g, '\n')
  return Buffer.from(k, 'base64').toString('utf8')
}

function initAdmin() {
  if (getApps().length) return getApp()
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey(),
    }),
  })
}

// Lazy singletons — initialized on first use, not at module load time
let _db: Firestore | null = null
let _auth: Auth | null = null

export function getAdminDb(): Firestore {
  if (!_db) _db = getFirestore(initAdmin())
  return _db
}

export function getAdminAuth(): Auth {
  if (!_auth) _auth = getAuth(initAdmin())
  return _auth
}

// Keep legacy names as aliases so existing imports don't break
export const adminDb = new Proxy({} as Firestore, {
  get(_, prop) { return Reflect.get(getAdminDb(), prop as string) },
})

export const adminAuth = new Proxy({} as Auth, {
  get(_, prop) { return Reflect.get(getAdminAuth(), prop as string) },
})
