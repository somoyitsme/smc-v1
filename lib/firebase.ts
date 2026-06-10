import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value && value.trim() !== ''
)

const isMockMode = !isFirebaseConfigured || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'mock-project'

let app: any
let auth: any

if (typeof window !== 'undefined') {
  if (!isFirebaseConfigured) {
    console.error(
      'Firebase configuration is incomplete. Please set all NEXT_PUBLIC_FIREBASE_* environment variables.',
      'Missing:',
      Object.entries(firebaseConfig)
        .filter(([, v]) => !v || (typeof v === 'string' && v.trim() === ''))
        .map(([k]) => k)
    )
    auth = null
  } else {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    auth = getAuth(app)
  }
} else {
  auth = null
}

export { app, auth, isFirebaseConfigured, isMockMode }
