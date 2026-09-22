#!/usr/bin/env node
// Mirror the Nintendo wish list into the Video Games shelf.
//
// Nintendo's share link is a *snapshot*: the games are written into the link
// itself (…#skus=7100112715,7100098088,…) and it never changes afterwards. So
// unlike LEGO there is no live list to watch. Instead the latest link you have
// shared lives in Firestore (settings/nintendo), pasted in from the site, and
// this script brings the shelf into line with it — and keeps every game's
// price current, since the eShop runs sales constantly.
//
// Rules, same as LEGO: adds what is new, removes only games it added that are
// still merely wanted, never touches anything typed by hand, and only ever
// changes the price of a game already here.
//
//   node scripts/sync-nintendo.mjs            # the real thing
//   node scripts/sync-nintendo.mjs --dry-run  # say what it would do

import { pathToFileURL } from 'node:url'
import { UA, cents, clean, log, openFirestore, readShelf, unshout } from './lib.mjs'

const SOURCE = 'nintendo-wishlist'
const DRY = process.argv.includes('--dry-run')

// Nintendo's product API only answers queries it has registered in advance,
// named by a fingerprint. This is the one its own wish list page uses. If
// Nintendo ever changes that query the fingerprint stops working, and the run
// fails loudly below rather than quietly.
const PRODUCTS_QUERY = '59756f2f449c58a5d5fffabbbeaf08b7b6bcb419bbef809927dfd4f738d7e7c5'

/** The game numbers written into a Nintendo share link. */
export function skusFromLink(link) {
  const hash = link.includes('#') ? link.slice(link.indexOf('#') + 1) : ''
  const skus = new URLSearchParams(hash).get('skus') ?? ''
  return skus.split(',').map((s) => s.trim()).filter((s) => /^\d{6,}$/.test(s))
}

/**
 * One request to Nintendo, retried.
 *
 * Nintendo's API is intermittent: now and then it answers "Unauthorized" with
 * no games at all, and the identical request a few seconds later is fine. So a
 * failure is retried twice, with a pause, before the run gives up — and giving
 * up changes nothing, so the next run simply tries again.
 */
async function askNintendo(url) {
  let why = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        // Without these Nintendo's API answers every request with a 500.
        'apollographql-client-name': 'ncom',
        'apollographql-client-version': '1.0.0',
      },
    })
    const body = await res.json().catch(() => null)
    const products = body?.data?.products
    if (Array.isArray(products)) return products
    why = body?.errors?.[0]?.message ?? `HTTP ${res.status}`
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 4000))
  }
  throw new Error(
    `Nintendo didn't return games after 3 tries (${why}). Nothing was changed; the next run will try again.`,
  )
}

async function fetchGames(skus) {
  const games = []
  // A long list goes in batches, to keep each request's address a sane length.
  for (let i = 0; i < skus.length; i += 40) {
    const batch = skus.slice(i, i + 40)
    const url =
      'https://graph.nintendo.com/?operationName=Products' +
      `&variables=${encodeURIComponent(JSON.stringify({ skus: batch }))}` +
      `&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: PRODUCTS_QUERY } }))}`
    const products = await askNintendo(url)
    for (const p of products) {
      if (!p?.sku) continue
      const price = p.prices?.finalPrice
      games.push({
        sku: p.sku,
        name: clean(p.name).replace(/\s*\((coming soon|pre-?order)\)\s*$/i, ''),
        publisher: unshout(clean(p.softwarePublisher)),
        console: p.platform?.label ?? '',
        year: (p.releaseDate ?? '').slice(0, 4),
        cover: p.productImageSquare?.url ?? '',
        // The day it comes out. Anything still ahead is a pre-order, and the
        // shelf says so rather than showing it as something you can go buy.
        released: (p.releaseDate ?? '').slice(0, 10),
        // Nintendo says which of the unreleased ones it will take money for
        // now: ["Pre-order","Coming soon"] against a bare ["Coming soon"].
        preorder: (p.availability ?? []).includes('Pre-order'),
        link: `https://www.nintendo.com/us/store/products/${p.urlKey}`,
        price: typeof price === 'number' ? Math.round(price * 100) : null,
      })
    }
  }
  return games
}

export function plan(games, shelf) {
  const onShelf = new Set(shelf.map((i) => i.ref).filter(Boolean))
  const onList = new Set(games.map((g) => g.sku))
  return {
    add: games.filter((g) => !onShelf.has(g.sku)),
    remove: shelf.filter(
      (i) => i.source === SOURCE && i.status === 'wants' && !onList.has(i.ref),
    ),
    // Prices move — sales, increases — and a release date can slip, so both
    // are brought into line on every run for games this script knows.
    reprice: shelf
      .filter((i) => i.source === SOURCE)
      .map((i) => {
        const g = games.find((g) => g.sku === i.ref)
        if (!g) return null
        const patch = {}
        if (g.price != null && g.price !== i.price) patch.price = g.price
        if (g.released && g.released !== i.released) patch.released = g.released
        if (g.preorder !== i.preorder) patch.preorder = g.preorder
        return Object.keys(patch).length ? { id: i.id, ref: i.ref, from: i.price, to: g.price, patch } : null
      })
      .filter(Boolean),
  }
}

const toItem = (g) => ({
  category: 'switch',
  status: 'wants',
  title: g.name,
  creator: g.publisher,
  year: g.year,
  detail: '',
  // Nintendo Switch or Nintendo Switch 2 — the shelf's Console tags, exactly.
  tag: g.console,
  // Square key art, full to the edges: nothing to cut out.
  cover: g.cover,
  cutout: false,
  released: g.released,
  preorder: g.preorder,
  ref: g.sku,
  link: g.link,
  notes: '',
  addedAt: Date.now(),
  source: SOURCE,
  ...(g.price != null && { price: g.price }),
})

async function main() {
  log(DRY ? 'nintendo: dry run — nothing will change' : 'nintendo: syncing')

  const db = await openFirestore()
  const setting = (await db.collection('settings').doc('nintendo').get()).data()
  if (!setting?.wishlistUrl) {
    log('nintendo: no wish list link saved yet — paste one on the Video Games screen')
    return
  }

  const skus = skusFromLink(setting.wishlistUrl)
  const shelf = await readShelf('switch')
  const synced = shelf.filter((i) => i.source === SOURCE).length
  // A saved link with no games in it, when games have been synced before, is
  // far likelier to be a bad paste than a real emptying.
  if (skus.length === 0 && synced >= 3) {
    throw new Error(`the saved link lists no games but ${synced} are synced here — not deleting anything`)
  }

  const games = await fetchGames(skus)
  log(`nintendo: link lists ${skus.length} · Nintendo knows ${games.length} · shelf here ${shelf.length}`)

  const { add, remove, reprice } = plan(games, shelf)
  for (const g of add) log(`  + ${g.name}  [${g.console}]  ${cents(g.price)}`)
  for (const i of remove) log(`  − ${i.ref}  (no longer on the wish list)`)
  for (const r of reprice) {
    log(`  $ ${r.ref}  ${Object.keys(r.patch).join(', ')} updated`)
  }
  if (!add.length && !remove.length && !reprice.length) log('  nothing to change')
  if (DRY) return

  const col = db.collection('shelfItems')
  for (const g of add) await col.doc(`nintendo-${g.sku}`).set(toItem(g))
  for (const i of remove) await col.doc(i.id).delete()
  for (const r of reprice) await col.doc(r.id).update(r.patch)
  if (add.length || remove.length || reprice.length) {
    log(`nintendo: added ${add.length}, removed ${remove.length}, repriced ${reprice.length}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    log('nintendo FAILED:', err.message)
    process.exit(1)
  })
}
