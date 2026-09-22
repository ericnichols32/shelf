// What the shop syncs share: logging, reading the shelf, writing to Firestore.

import { access, readFile } from 'node:fs/promises'

export const PROJECT = 'eric-s-wish-list'
export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

export const log = (...a) => console.log(new Date().toISOString(), ...a)
export const exists = (p) => access(p).then(() => true, () => false)

/** Trademark marks and stray zero-width characters out of a shop's names. */
export const clean = (s) =>
  (s ?? '')
    .replace(/[™®​‌‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** "ROCKSTAR GAMES" reads as shouting. Leaves mixed-case names alone. */
export const unshout = (s) =>
  s && s === s.toUpperCase() && /[A-Z]{3}/.test(s)
    ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : s

/** One shelf as it stands, read the way any visitor could — it's public. */
export async function readShelf(category) {
  const out = []
  let page = ''
  do {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/shelfItems` +
      `?pageSize=300${page ? `&pageToken=${page}` : ''}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Firestore answered HTTP ${res.status}`)
    const body = await res.json()
    for (const d of body.documents ?? []) {
      const f = d.fields ?? {}
      const v = (k) => f[k]?.stringValue ?? ''
      if (v('category') !== category) continue
      const price = f.price?.integerValue ?? f.price?.doubleValue
      out.push({
        id: d.name.split('/').pop(),
        status: v('status'),
        code: v('detail'),
        ref: v('ref'),
        released: v('released'),
        preorder: f.preorder?.booleanValue ?? false,
        source: v('source'),
        price: price == null ? null : Number(price),
      })
    }
    page = body.nextPageToken ?? ''
  } while (page)
  return out
}

let db = null

/** Firestore with write access, through the service-account key. */
export async function openFirestore() {
  if (db) return db
  const keyPath = process.env.SHELF_SERVICE_ACCOUNT
  if (!keyPath) throw new Error('SHELF_SERVICE_ACCOUNT is not set — see the README')
  if (!(await exists(keyPath))) {
    throw new Error(`No service-account key at ${keyPath} — see the README.`)
  }
  const { initializeApp, cert } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const key = JSON.parse(await readFile(keyPath, 'utf8'))
  db = getFirestore(initializeApp({ credential: cert(key) }))
  return db
}

export const cents = (c) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`)
