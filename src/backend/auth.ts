// Signing in, and deciding who may write.
//
// The arrangement is deliberately lopsided: reading is open to everyone, and
// writing belongs to exactly one Google account — the one whose id is in
// VITE_OWNER_UID. That is what makes the link safe to hand out. It is enforced
// in firestore.rules, on Google's servers; this only mirrors the rule so that
// buttons which would be refused are never offered.

import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { SIGNED_OUT, type Viewer } from '../viewer'
import { firebaseApp } from './app'
import { ownerUid } from './config'

const toViewer = (user: User | null): Viewer =>
  user
    ? {
        signedIn: true,
        isOwner: Boolean(ownerUid) && user.uid === ownerUid,
        name: user.displayName ?? user.email ?? 'Signed in',
        uid: user.uid,
      }
    : SIGNED_OUT

export function watchViewer(listener: (viewer: Viewer) => void): () => void {
  return onAuthStateChanged(getAuth(firebaseApp()), (user) =>
    listener(toViewer(user)),
  )
}

export async function signIn(): Promise<void> {
  const provider = new GoogleAuthProvider()
  // Ask which account rather than silently reusing whichever Google account
  // the browser happens to be signed into.
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithPopup(getAuth(firebaseApp()), provider)
}

export const signOut = (): Promise<void> => firebaseSignOut(getAuth(firebaseApp()))
