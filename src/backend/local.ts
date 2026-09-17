// The collection, kept in this browser.
//
// This is what runs before Firebase is configured, and what keeps running if
// Firebase is never configured at all. It is a real store, not a stub — but the
// data lives in one browser on one device, so the app says so in the header.

import { normalise, type Item, type NewItem } from '../types'
import { byNewest, newId, type Store } from './types'

const KEY = 'shelf.items.v1'

function read(): Item[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as Item[]).map(normalise).sort(byNewest)
  } catch {
    // A private window, or storage the browser has blocked. An empty shelf is
    // a better answer here than a crash.
    return []
  }
}

function write(items: Item[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Out of quota or blocked. The in-memory copy still updates, so the session
    // works; it just will not survive a reload.
  }
}

const listeners = new Set<(items: Item[]) => void>()

function publish() {
  const items = read()
  listeners.forEach((l) => l(items))
}

export function createLocalStore(): Store {
  // Another tab of the same app writing counts as a change here too.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) publish()
  })

  return {
    mode: 'local',
    subscribe(listener) {
      listeners.add(listener)
      listener(read())
      return () => listeners.delete(listener)
    },
    async add(item: NewItem) {
      write([{ ...item, id: newId(), addedAt: Date.now() }, ...read()])
      publish()
    },
    async update(id, patch) {
      write(read().map((it) => (it.id === id ? { ...it, ...patch } : it)))
      publish()
    },
    async remove(id) {
      write(read().filter((it) => it.id !== id))
      publish()
    },
  }
}
