import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (() => {
        const k = process.env.FIREBASE_PRIVATE_KEY ?? ''
        if (k.startsWith('-----')) return k
        if (k.includes('\\n')) return k.replace(/\\n/g, '\n')
        return Buffer.from(k, 'base64').toString('utf8')
      })(),
    }),
  })
}

export const adminDb = getFirestore()
export const adminAuth = getAuth()
