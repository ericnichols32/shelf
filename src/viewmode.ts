// Which way a shelf is shown: the two-up grid, or the shelf's own browsing
// view — the crate for records, flicked through one at a time, or the
// bookshelf for books, slid along row by row. Remembered per shelf on this
// device, and shared between the top bar (which holds the switch) and the
// shelf (which obeys it).

import { useSyncExternalStore } from 'react'

export type ShelfView = 'grid' | 'crate' | 'shelf'

const key = (shelf: string) => `shelf.view.${shelf}`
const listeners = new Set<() => void>()

export function getView(shelf: string): ShelfView {
  try {
    const saved = localStorage.getItem(key(shelf))
    return saved === 'crate' || saved === 'shelf' ? saved : 'grid'
  } catch {
    return 'grid'
  }
}

export function setView(shelf: string, view: ShelfView) {
  try {
    localStorage.setItem(key(shelf), view)
  } catch {
    // A private window forgets; the switch still works for this visit.
  }
  memory.set(shelf, view)
  listeners.forEach((l) => l())
}

/** For when storage is unavailable, so the switch still flips this visit. */
const memory = new Map<string, ShelfView>()

export function useView(shelf: string): ShelfView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => memory.get(shelf) ?? getView(shelf),
  )
}
