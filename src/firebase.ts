import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { defaultFirebaseConfig } from './firebaseConfig'
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() || defaultFirebaseConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || defaultFirebaseConfig.appId,
}
export const firebaseProjectId = config.projectId || ''
export const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)'
export const configured = Object.values(config).every(Boolean)
const app = configured ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app, firestoreDatabaseId) : null

