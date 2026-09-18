// The Nintendo wish list link, kept where the sync on the Mac can find it.
//
// Nintendo's share link is a snapshot — the games are written into the link —
// so when the wish list changes, a fresh link has to be shared and saved here.
// scripts/sync-nintendo.mjs reads it on each run.

import { cloudConfigured } from './config'

async function nintendoDoc() {
  const { doc, getFirestore } = await import('firebase/firestore')
  const { firebaseApp } = await import('./app')
  return doc(getFirestore(firebaseApp()), 'settings', 'nintendo')
}

export async function readNintendoLink(): Promise<string> {
  if (!cloudConfigured) return ''
  const { getDoc } = await import('firebase/firestore')
  const snap = await getDoc(await nintendoDoc())
  return snap.exists() ? (snap.data().wishlistUrl ?? '') : ''
}

export async function saveNintendoLink(wishlistUrl: string): Promise<void> {
  const { setDoc } = await import('firebase/firestore')
  await setDoc(await nintendoDoc(), { wishlistUrl, savedAt: Date.now() })
}

/** The game numbers in a share link — the same reading the sync does. */
export function gamesInLink(link: string): number {
  const hash = link.includes('#') ? link.slice(link.indexOf('#') + 1) : ''
  return (new URLSearchParams(hash).get('skus') ?? '')
    .split(',')
    .filter((s) => /^\d{6,}$/.test(s.trim())).length
}
