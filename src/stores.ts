// From a shop's name, as typed on a phone in the shop, to its website.
//
// The shops Eric uses are written down here so they never cost a search. Any
// other name is looked up once — the first result that is the shop itself
// rather than a review or a map — and remembered on this device after that.

import type { Category } from './categories'
import { hostOf, webSearch } from './web'

const KNOWN: Record<string, string> = {
  'mcnally jackson': 'mcnallyjackson.com',
  mcnally: 'mcnallyjackson.com',
  strand: 'strandbooks.com',
  'the strand': 'strandbooks.com',
  'books are magic': 'booksaremagic.net',
  greenlight: 'greenlightbookstore.com',
  'greenlight bookstore': 'greenlightbookstore.com',
  "powell's": 'powells.com',
  powells: 'powells.com',
  'barnes & noble': 'barnesandnoble.com',
  'barnes and noble': 'barnesandnoble.com',
  'b&n': 'barnesandnoble.com',
  bookshop: 'bookshop.org',
  'bookshop.org': 'bookshop.org',
  'rough trade': 'roughtrade.com',
  gruv: 'gruv.com',
  criterion: 'criterion.com',
  lego: 'lego.com',
  'lego store': 'lego.com',
  bricklink: 'bricklink.com',
  nintendo: 'nintendo.com',
  'nintendo new york': 'nintendo.com',
  'best buy': 'bestbuy.com',
  target: 'target.com',
  discogs: 'discogs.com',
}

/** Sites that come up when you search for a shop but aren't the shop. */
const NOT_THE_SHOP =
  /yelp|google|facebook|instagram|tripadvisor|wikipedia|mapquest|foursquare|timeout|nytimes|reddit|linkedin|twitter|x\.com|tiktok|youtube|apple\.com|bing|duckduckgo|yellowpages|bbb\.org|eater|infatuation|secretnyc|newyorker|curbed|nymag|thrillist|patch\.com|wanderlog|restaurantji|chamberofcommerce|indiebound|bookshop\.org\/shop|substack|medium\.com/i

const KIND: Record<Category['id'], string> = {
  vinyl: 'record store',
  bluray: 'blu-ray store',
  books: 'bookstore',
  lego: 'LEGO store',
  switch: 'video game store',
}

const MEMORY_KEY = 'shelf.stores.v1'

function remembered(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function remember(name: string, domain: string) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...remembered(), [name]: domain }))
  } catch {
    // A private window; it will simply be looked up again next time.
  }
}

const key = (name: string) => name.trim().toLowerCase().replace(/[’']/g, "'")

export async function storeWebsite(
  name: string,
  category: Category,
  signal: AbortSignal,
): Promise<string | null> {
  const k = key(name)
  if (!k) return null
  if (k.includes('.') && !k.includes(' ')) return hostOf(`https://${k}`)
  if (KNOWN[k]) return KNOWN[k]
  const mine = remembered()[k]
  if (mine) return mine

  const results = await webSearch(`${name} ${KIND[category.id]}`, signal)
  const shop = results.map((r) => hostOf(r.url)).find((h) => h && !NOT_THE_SHOP.test(h))
  if (shop) remember(k, shop)
  return shop ?? null
}

/** The shelf's own shop, to start the Store box with. */
export function defaultStore(category: Category): string {
  try {
    const last = localStorage.getItem(`shelf.store.${category.id}`)
    if (last) return last
  } catch {
    // Fall through to the shelf's preferred shop.
  }
  return {
    vinyl: 'Rough Trade',
    bluray: 'Gruv',
    books: 'McNally Jackson',
    lego: 'LEGO',
    switch: 'Nintendo',
  }[category.id]
}

export function rememberStore(category: Category, name: string) {
  try {
    localStorage.setItem(`shelf.store.${category.id}`, name.trim())
  } catch {
    // Not worth mentioning.
  }
}
