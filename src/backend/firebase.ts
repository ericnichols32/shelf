// The collection, kept in Firestore.
//
// Reads are open to anyone: that is what makes the link worth sending. Writes
// belong to one Google account and nobody else, which is enforced in
// firestore.rules rather than here. Signing in is a deliberate act — see
// backend/auth.ts — so an ordinary visitor carries no credential at all.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'
import { normalise, type NewItem } from '../types'
import { firebaseApp } from './app'
import { byPosition, type Store } from './types'

const COLLECTION = 'shelfItems'

export function createCloudStore(): Store {
  const db = getFirestore(firebaseApp())
  const items = collection(db, COLLECTION)

  return {
    mode: 'cloud',
    subscribe(listener) {
      return onSnapshot(
        items,
        (snap) => {
          const all = snap.docs.map((d) =>
            normalise({ id: d.id, ...d.data() }),
          )
          listener(all.sort(byPosition))
        },
        (err) => console.error('Shelf: could not read the collection.', err),
      )
    },
    async add(item: NewItem) {
      await addDoc(items, { ...item, addedAt: Date.now() })
    },
    async update(id, patch) {
      await updateDoc(doc(db, COLLECTION, id), patch)
    },
    async remove(id) {
      await deleteDoc(doc(db, COLLECTION, id))
    },
  }
}
