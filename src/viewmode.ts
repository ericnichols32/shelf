// Which way a shelf is shown: the two-up grid, or the shelf's own browsing
// view — the crate for records, flicked through one at a time, or the
// bookshelf for books. Shared between the top bar (which holds the switch)
// and the shelf (which obeys it).
//
// Every shelf opens on the grid. The other view is a tap away and stays put
// while you move around the site, but a fresh visit starts on the grid.

import { useSyncExternalStore } from 'react'

export type ShelfView = 'grid' | 'crate' | 'shelf'

const chosen = new Map<string, ShelfView>()
const listeners = new Set<() => void>()

export function setView(shelf: string, view: ShelfView) {
  try {
    // Views used to be remembered between visits; clear what was left.
    localStorage.removeItem(`shelf.view.${shelf}`)
  } catch {
    // Nothing to clear.
  }
  chosen.set(shelf, view)
  listeners.forEach((l) => l())
}

export function useView(shelf: string): ShelfView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => chosen.get(shelf) ?? 'grid',
  )
}
