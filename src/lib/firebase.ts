import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

export { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, setDoc }

// Helpers for common Firestore patterns
export async function getAllDocs<T>(col: string): Promise<T[]> {
  const snap = await getDocs(collection(db, col))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T)
}

export async function getDocById<T>(col: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, col, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null
}

export async function addDocument<T extends object>(col: string, data: T): Promise<string> {
  const ref = await addDoc(collection(db, col), data)
  return ref.id
}

export async function addDocumentWithId<T extends object>(col: string, id: string, data: T): Promise<void> {
  await setDoc(doc(db, col, id), data)
}

export async function updateDocument(col: string, id: string, data: Partial<Record<string, unknown>>): Promise<void> {
  await updateDoc(doc(db, col, id), data)
}

export async function deleteDocument(col: string, id: string): Promise<void> {
  await deleteDoc(doc(db, col, id))
}
