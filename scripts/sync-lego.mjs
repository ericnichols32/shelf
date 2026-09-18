#!/usr/bin/env node
// Mirror the LEGO.com wish list into the collection. Run daily by launchd.
//
// Why this runs on the Mac and not on GitHub: LEGO's wish list API refuses
// requests from datacentres — a GitHub Actions runner gets a 403 — and answers
// an ordinary home connection. That is LEGO's access rule and this does not try
// to get around it. From here it is no different from opening the wish list in
// a browser once a day.
//
// What it does, in order:
//   1. read the public wish list from LEGO
//   2. read the LEGO shelf from Firestore
//   3. add sets that are new on LEGO; remove ones this script added that have
//      since left the LEGO list and are still only wanted
//
// Pictures are LEGO's own, linked rather than copied. They already come with a
// transparent background and a tight frame, so there is nothing to cut out —
// an earlier version copied them into the site to run the cut-out on them,
// which was solving a problem they never had.
//
// Usage:
//   node scripts/sync-lego.mjs              # the real thing
//   node scripts/sync-lego.mjs --dry-run    # say what it would do, change nothing
//
// Writing needs a Firebase service-account key, found through
// SHELF_SERVICE_ACCOUNT (a path). Reading needs nothing: the collection is
// public on purpose, so a dry run works with no key at all.

import { access, readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const WISHLIST_ID = '7e749c7c-7da9-480d-a3cd-b6168ff4ad8e'
const PROJECT = 'eric-s-wish-list'
const SOURCE = 'lego-wishlist'
const DRY = process.argv.includes('--dry-run')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

const log = (...a) => console.log(new Date().toISOString(), ...a)

/** Trademark marks and stray zero-width characters out of LEGO's names. */
const clean = (s) =>
  (s ?? '')
    .replace(/[™®​‌‍﻿]/g, '')
    .replace(/^LEGO\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()

// ---- 1. LEGO ---------------------------------------------------------------

async function fetchWishlist() {
  const res = await fetch(
    'https://www.lego.com/api/graphql/GetPublicWishListById',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-locale': 'en-US', 'user-agent': UA },
      body: JSON.stringify({
        operationName: 'GetPublicWishListById',
        variables: { id: WISHLIST_ID },
        query: `query GetPublicWishListById($id: String!) {
          listGetPublicById(id: $id) {
            lineItems {
              addedAt
              product { name slug productCode primaryImage brandCategory { name } }
              productVariant { price { centAmount } }
            }
          }
        }`,
      }),
    },
  )
  if (!res.ok) throw new Error(`LEGO answered HTTP ${res.status}`)
  const body = await res.json()
  const lines = body?.data?.listGetPublicById?.lineItems
  // Anything but a real list is a failure, not an empty wish list. Reading a
  // broken answer as "you want nothing" would delete every synced set.
  if (!Array.isArray(lines)) {
    throw new Error(`Unexpected answer from LEGO: ${JSON.stringify(body).slice(0, 200)}`)
  }
  return lines.map(({ addedAt, product: p, productVariant }) => ({
    code: p.productCode,
    name: clean(p.name),
    theme: clean(p.brandCategory?.name),
    link: `https://www.lego.com/en-us/product/${p.slug}`,
    image: p.primaryImage.split('?')[0],
    addedAt: Date.parse(addedAt) || Date.now(),
    // Current price, sales included. Absent for the odd set LEGO lists
    // without one; those simply show no price.
    price: productVariant?.price?.centAmount ?? null,
  }))
}

// ---- 2. Firestore, read ------------------------------------------------------

/** The LEGO shelf as it stands, read the same way any visitor could. */
async function readShelf() {
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
      if (v('category') !== 'lego') continue
      const price = f.price?.integerValue ?? f.price?.doubleValue
      out.push({
        id: d.name.split('/').pop(),
        status: v('status'),
        code: v('detail'),
        source: v('source'),
        price: price == null ? null : Number(price),
      })
    }
    page = body.nextPageToken ?? ''
  } while (page)
  return out
}

// ---- 3. what to change -------------------------------------------------------

export function plan(wishlist, shelf) {
  const onShelf = new Set(shelf.map((i) => i.code).filter(Boolean))
  const onLego = new Set(wishlist.map((w) => w.code))
  return {
    // Any set already on the shelf is left alone, whichever side it is on —
    // it may have been moved to the collection, or edited by hand.
    add: wishlist.filter((w) => !onShelf.has(w.code)),
    // Only sets this script added, and only while still merely wanted. One
    // that has been moved to the collection was bought, and stays.
    remove: shelf.filter(
      (i) => i.source === SOURCE && i.status === 'wants' && !onLego.has(i.code),
    ),
    // Prices move — sales, increases — so a set already here takes LEGO's
    // current price. Only the price: nothing you may have edited is touched,
    // and only on sets this script added.
    reprice: shelf
      .filter((i) => i.source === SOURCE)
      .map((i) => {
        const now = wishlist.find((w) => w.code === i.code)?.price
        return now != null && now !== i.price ? { id: i.id, code: i.code, from: i.price, to: now } : null
      })
      .filter(Boolean),
  }
}

const exists = (p) => access(p).then(() => true, () => false)

/**
 * LEGO's picture, asked for at a sensible size. fit=bounds matters: without it
 * their image server stretches the picture to fill exactly the width asked for
 * and squashes anything that isn't square.
 */
const pictureUrl = (image) =>
  `${image}?format=webply&fit=bounds&quality=80&width=800`

// ---- 5. Firestore, write -------------------------------------------------------

async function openFirestore() {
  const keyPath = process.env.SHELF_SERVICE_ACCOUNT
  if (!keyPath) throw new Error('SHELF_SERVICE_ACCOUNT is not set — see the README')
  const { initializeApp, cert } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  if (!(await exists(keyPath))) {
    throw new Error(
      `No service-account key at ${keyPath}. Reading LEGO worked; writing ` +
        'needs the key — see "LEGO wish list" in the README.',
    )
  }
  const key = JSON.parse(await readFile(keyPath, 'utf8'))
  return getFirestore(initializeApp({ credential: cert(key) }))
}

const toItem = (set) => ({
  category: 'lego',
  status: 'wants',
  title: set.name,
  creator: set.theme,
  year: '',
  detail: set.code,
  tag: '',
  cover: pictureUrl(set.image),
  cutout: true,
  ref: '',
  link: set.link,
  notes: '',
  addedAt: set.addedAt,
  source: SOURCE,
  ...(set.price != null && { price: set.price }),
})

// ---- the run ---------------------------------------------------------------------

async function main() {
  log(DRY ? 'dry run — nothing will change' : 'syncing')

  const wishlist = await fetchWishlist()
  const shelf = await readShelf()
  log(`LEGO wish list: ${wishlist.length} sets · LEGO shelf here: ${shelf.length} items`)

  const { add, remove, reprice } = plan(wishlist, shelf)

  // A wish list that suddenly reads as empty, when this script has put several
  // sets here before, is far likelier to be LEGO changing its API than a real
  // emptying. Refuse to act on it rather than wipe the shelf.
  const synced = shelf.filter((i) => i.source === SOURCE).length
  if (wishlist.length === 0 && synced >= 3) {
    throw new Error(`LEGO returned no sets but ${synced} are synced here — not deleting anything`)
  }

  for (const s of add) log(`  + ${s.code}  ${s.name}  [${s.theme || '—'}]`)
  for (const i of remove) log(`  − ${i.code}  (left the LEGO wish list)`)
  const cents = (c) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`)
  for (const r of reprice) log(`  $ ${r.code}  ${cents(r.from)} → ${cents(r.to)}`)
  if (!add.length && !remove.length && !reprice.length) log('  nothing to change')

  if (DRY) return

  if (add.length || remove.length || reprice.length) {
    const db = await openFirestore()
    const col = db.collection('shelfItems')
    for (const s of add) await col.doc(`lego-${s.code}`).set(toItem(s))
    for (const i of remove) await col.doc(i.id).delete()
    for (const r of reprice) await col.doc(r.id).update({ price: r.to })
    log(`Firestore: added ${add.length}, removed ${remove.length}, repriced ${reprice.length}`)
  }

  log('done')
}

// Run only when invoked directly, so the planning can be imported and tested.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    log('FAILED:', err.message)
    process.exit(1)
  })
}
