// The signed-in session, fetched only when there is a project to sign in to.
//
// Firebase is the largest thing in the build, so nothing here imports it until
// it is actually needed — the same bargain the store makes in index.ts.

import { cloudConfigured } from './config'
import { SIGNED_OUT, type Viewer } from '../viewer'

/** The store creates the Firebase app; auth attaches to whatever it made. */
const auth = () => import('./auth')

export function watchViewer(listener: (viewer: Viewer) => void): () => void {
  if (!cloudConfigured) {
    listener(SIGNED_OUT)
    return () => {}
  }
  let stop: (() => void) | null = null
  let cancelled = false
  auth().then(({ watchViewer: watch }) => {
    if (!cancelled) stop = watch(listener)
  })
  return () => {
    cancelled = true
    stop?.()
  }
}

export const signIn = async () => (await auth()).signIn()
export const signOut = async () => (await auth()).signOut()
