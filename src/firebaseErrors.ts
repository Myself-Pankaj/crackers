export function firebaseErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string } | null
  const code = (value?.code || '').replace(/^(firestore|auth)\//, '')
  switch (code) {
    case 'permission-denied':
      return 'Firestore denied access. Publish the updated firestore.rules in Firebase Console → Firestore Database → Rules, and sign in with your store account.'
    case 'unauthenticated':
    case 'user-token-expired':
    case 'invalid-user-token':
      return 'Your session has expired. Sign out and sign in again.'
    case 'operation-not-allowed':
      return 'Enable Email/Password in Firebase Console → Authentication → Sign-in method.'
    case 'invalid-credential':
    case 'wrong-password':
    case 'user-not-found':
      return 'The email or password is incorrect. Use an account created under Firebase Authentication → Users.'
    case 'invalid-email':
      return 'Enter a valid email address.'
    case 'too-many-requests':
      return 'Too many sign-in attempts. Please wait before trying again.'
    case 'network-request-failed':
    case 'unavailable':
      return 'Cannot reach Firebase. Check your internet connection and retry. The item has not been confirmed as saved online.'
    case 'not-found':
      return 'The Firestore database was not found. Check your Firebase project and database ID. For a named database, set VITE_FIREBASE_DATABASE_ID in .env.local and restart Vite.'
    default:
      return value?.message || 'Firebase could not complete this request. Please retry.'
  }
}
