import type { Item, NewItem } from '../types'

/**
 * The one thing the rest of the app knows about storage.
 *
 * Two implementations sit behind it: Firestore when the app is configured for
 * it, and the browser's own storage when it is not. The app never checks which.
 */
export interface Store {
  mode: 'cloud' | 'local'
  /** Calls back with the whole collection now, and again on every change. */
  subscribe(listener: (items: Item[]) => void): () => void
  add(item: NewItem): Promise<void>
  update(id: string, patch: Partial<Item>): Promise<void>
  remove(id: string): Promise<void>
}

export const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/**
 * The order a list reads in: hand-placed first, then newest.
 *
 * Re-exported from types so the two stores sort identically without either
 * knowing how the ordering works.
 */
export { byPosition } from '../types'
