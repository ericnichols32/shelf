// Filling in a new item from a link, or from a photo taken in a shop.
//
// From a link: the page is read, Gemini picks the title and maker out of it
// (shops dress their titles up — "Rumours - Vinyl, CD | Rough Trade - (LP -
// Black, 2LP - Black)"), and the page's own picture becomes the cover.
//
// From a photo: Gemini says what's in it, the shop you name afterwards is
// found online, the thing is found on that shop's site, and that page supplies the
// link and the cover — the same as if its address had been pasted.
//
// Either way the free catalogues (Apple Music, TMDB, Open Library) fill any
// field still blank. Nothing here saves anything; it hands values to the form,
// which is still there to be checked.

import { askJson, AiUnavailable, photoPart } from './ai'
import type { Category } from './categories'
import { bookIsbns, imageExists, lookup } from './lookup'
import { storeWebsite } from './stores'
import type { CategoryId, NewItem } from './types'
import { hostOf, pageExists, readPage, webSearch, type Page, type SearchResult } from './web'

export type Filled = Partial<
  Pick<NewItem, 'title' | 'creator' | 'year' | 'detail' | 'cover' | 'cutout' | 'link' | 'ref' | 'price'>
>

export type Step = (message: string) => void

interface Details {
  title: string
  creator?: string
  year?: string
  detail?: string
  isbn?: string
  price?: number
}

/** What each field means on each shelf, in words Gemini can follow. */
const GUIDE: Record<CategoryId, string> = {
  vinyl:
    'a record. title = the album title only. creator = the recording artist. year = the album’s original release year. detail = the pressing or variant if a specific one is shown (e.g. "Clear vinyl", "2LP 180g"), else empty.',
  bluray:
    'a film on disc. title = the film’s title only, with no format or edition words. creator = the film’s director (from the page, or your own knowledge of the film). year = the film’s original release year. detail = the edition if stated (e.g. "Criterion #712", "4K UHD Steelbook"), else empty.',
  books:
    'a book. title = the book’s title only; drop marketing such as "A Novel" or "A GMA Book Club Pick", but keep a subtitle that is genuinely part of the title. creator = the author. year = the year it was first published. detail = "Hardcover" or "Paperback" if stated, else empty. isbn = the 13-digit ISBN if shown.',
  lego:
    'a LEGO set. title = the set’s name without "LEGO", the theme or the set number (e.g. "Rivendell"). creator = the LEGO theme (e.g. "Icons", "Ideas", "Star Wars"), without the word LEGO. detail = the set number, digits only. year = the release year if shown.',
  switch:
    'a video game. title = the game’s name only, without platform words unless they are part of the name. creator = the publisher. year = the release year.',
}

const TITLE_CASE =
  'Write names in normal title case even where the source SHOUTS IN CAPITALS, and leave out ™ and ® marks.'

const detailsSchema = (S: typeof import('firebase/ai').Schema) =>
  S.object({
    properties: {
      title: S.string(),
      creator: S.string(),
      year: S.string(),
      detail: S.string(),
      isbn: S.string(),
      price: S.number({ description: 'Price in US dollars, if the page shows one.' }),
    },
    optionalProperties: ['creator', 'year', 'detail', 'isbn', 'price'],
  })

// ---------------------------------------------------------------- reading a page

const clean = (s = '') => s.replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim()

/** Price from the shop's structured data, where it gives one. */
function priceFrom(page: Page): number | undefined {
  const m = page.structured.match(/"price"\s*:\s*"?(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : undefined
}

/** A fair reading without Gemini, for when it isn't switched on. */
function plainReading(category: Category, page: Page): Details {
  let ld: Array<Record<string, unknown>> = []
  try {
    ld = JSON.parse(page.structured || '[]')
  } catch {
    // Truncated; go without.
  }
  const name = (v: unknown): string =>
    typeof v === 'string'
      ? v
      : Array.isArray(v)
        ? name(v[0])
        : v && typeof v === 'object' && 'name' in v
          ? String((v as { name: unknown }).name)
          : ''
  const first = ld[0] ?? {}
  const segments = page.title.split(/\s+[|–—]\s+/)
  const title = tidyTitle((name(first.name) || segments[0]).replace(/\s+\d{4,6}$/, ''))
  let creator = clean(name(first.author) || name(first.director) || name(first.byArtist) || page.author)
  let detail = ''
  if (category.id === 'lego') {
    detail = page.url.match(/(\d{4,6})\/?$/)?.[1] ?? ''
    // LEGO titles its pages "RIVENDELL™ 10316 | LEGO® Icons | Buy online…".
    creator = clean((segments[1] ?? '').replace(/lego\W*/i, '')) || creator
    if (/^lego$/i.test(creator)) creator = ''
  }
  return { title, creator, detail, price: priceFrom(page) }
}

const FORMAT_WORDS =
  /blu-?ray|4k|uhd|dvd|vinyl|\blp\b|\bcd\b|cassette|hardcover|paperback|edition|steelbook|remaster|compact disc|digital/i

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to'])

/**
 * A shop's product title cut down to the work's own name: no "[UHD]" or
 * "(Paperback)", no ": A GMA Book Club Pick: A novel", and not in capitals.
 */
function tidyTitle(raw: string): string {
  let t = clean(raw)
  let prev = ''
  while (prev !== t) {
    prev = t
    t = t.replace(/\s*[([][^)\]]*[)\]]\s*$/, (m) => (FORMAT_WORDS.test(m) ? '' : m)).trim()
  }
  t = t
    .split(/:\s+/)
    .filter((part, i) => i === 0 || !/\b(a novel|a memoir|book club|pick|edition|stories)\b/i.test(part))
    .join(': ')
  if (t && !/[a-z]/.test(t)) {
    t = t
      .toLowerCase()
      .split(' ')
      .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')
      .replace(/: (\w)/g, (_, c: string) => `: ${c.toUpperCase()}`)
  }
  return t
}

async function readDetails(category: Category, page: Page): Promise<Details> {
  try {
    const found = await askJson<Details>(
      [
        `This is a shop's product page for ${GUIDE[category.id]} ${TITLE_CASE} Leave a field empty rather than guess. ` +
          `Leave out anything that is the shop's name or a format label.\n\n` +
          `Address: ${page.url}\nPage title: ${page.title}\nDescription: ${page.description}\n` +
          `Author tag: ${page.author}\nStructured data: ${page.structured}\nPage text: ${page.text}`,
      ],
      detailsSchema,
    )
    if (found.title) return { ...found, price: found.price ?? priceFrom(page) }
  } catch (err) {
    if (!(err instanceof AiUnavailable)) console.error(err)
  }
  return plainReading(category, page)
}

/**
 * Whether a shelf's covers get their background cut out — the same answer the
 * rest of that shelf already has, so a new cover lines up with its neighbours.
 *
 * Blu-rays and LEGO sets are boxes, cut out and stood at a common height (the
 * prepared Blu-rays and the synced sets are all cut). Records, books and games
 * are flat artwork edge to edge, and cutting those only eats into the art:
 * Rumours is a photograph on white, and the cut left Stevie and Mick floating.
 */
const CUT: Record<CategoryId, boolean> = {
  vinyl: false,
  bluray: true,
  books: false,
  lego: true,
  switch: false,
}

/**
 * The page's picture, made ready for the shelf. LEGO's are already
 * transparent and only need asking for at the right size — with fit=bounds,
 * or LEGO stretches them to the box.
 */
function coverFrom(category: Category, page: Page): Pick<Filled, 'cover' | 'cutout'> {
  const image = page.image
  if (!image) return {}
  const cover = /lego\.com\/cdn\//.test(image)
    ? `${image.split('?')[0]}?format=webply&fit=bounds&quality=80&width=800`
    : image
  return { cover, cutout: CUT[category.id] }
}

/** Blank fields filled from the free catalogues, as typing a title would. */
async function fillBlanks(category: Category, filled: Filled, signal: AbortSignal) {
  if (filled.creator && filled.year && filled.cover) return
  const { found } = await lookup(
    category.id,
    { title: filled.title ?? '', creator: filled.creator ?? '', detail: filled.detail ?? '' },
    signal,
  ).catch(() => ({ found: null }))
  if (!found) return
  filled.creator ||= found.creator
  filled.year ||= found.year
  if (!filled.cover && found.cover) {
    filled.cover = found.cover
    filled.cutout = CUT[category.id]
  }
  if (category.id === 'books') filled.ref ||= found.ref
}

function toFilled(category: Category, d: Details): Filled {
  const filled: Filled = {
    title: tidyTitle(d.title),
    creator: clean(d.creator),
    year: (d.year ?? '').match(/\d{4}/)?.[0] ?? '',
    detail: clean(d.detail),
  }
  if (category.id === 'books' && d.isbn) filled.ref = d.isbn.replace(/[^0-9X]/gi, '')
  if (d.price && d.price > 0) filled.price = Math.round(d.price * 100)
  return filled
}

export async function fromLink(
  category: Category,
  url: string,
  signal: AbortSignal,
  step: Step,
): Promise<Filled> {
  step('Reading the page…')
  const page = await readPage(url, signal)
  step('Picking out the details…')
  const details = await readDetails(category, page)
  const filled = { ...toFilled(category, details), ...coverFrom(category, page), link: url }
  await fillBlanks(category, filled, signal)
  return filled
}

// ---------------------------------------------------------------- from a photo

export interface Seen extends Details {
  recognised: boolean
  /** Books: ISBNs Gemini knows for the American editions — checked, not trusted. */
  isbns?: string[]
}

const seenSchema = (S: typeof import('firebase/ai').Schema) =>
  S.object({
    properties: {
      recognised: S.boolean(),
      title: S.string(),
      creator: S.string(),
      year: S.string(),
      detail: S.string(),
      isbn: S.string(),
      isbns: S.array({
        items: S.string(),
        description:
          'For a book only: ISBN-13s of its current US print editions that you know, hardcover and paperback, most widely stocked first. Empty if unsure.',
      }),
    },
    optionalProperties: ['creator', 'year', 'detail', 'isbn', 'isbns'],
  })

/**
 * What's in a photo — a camera shot in a shop, or a picture from the library.
 * Throws with a message fit to show if it can't tell.
 */
export async function identifyPhoto(category: Category, photo: Blob): Promise<Seen> {
  const seen = await askJson<Seen>(
    [
      `This photo shows ${GUIDE[category.id]} It may be taken in a shop, or be a screenshot or a saved picture. ` +
        `Identify exactly which one it is from the cover, box or spine — use your own knowledge to complete the details. ` +
        `${TITLE_CASE} If you can't tell what it is, set recognised to false.`,
      await photoPart(photo),
    ],
    seenSchema,
  )
  if (!seen.recognised || !seen.title) {
    throw new Error('Couldn’t make out what that is — try a closer, straighter photo of the front.')
  }
  return seen
}

/** The form's fields from a photo alone — enough to show while the shop is searched. */
export const seenToFilled = (category: Category, seen: Seen): Filled => toFilled(category, seen)

/**
 * Everything else, once the shop is known: the item found on that shop's
 * site gives the link and the cover, and the catalogues fill what's left. With
 * no shop, the catalogues do it all and the link is left for the shelf's own.
 */
export async function fromSeen(
  category: Category,
  seen: Seen,
  store: string,
  signal: AbortSignal,
  step: Step,
): Promise<{ filled: Filled; note?: string }> {
  const filled = toFilled(category, seen)
  store = store.trim()
  let note: string | undefined
  if (store) {
    step(`Looking for ${filled.title} on ${store}…`)
    const domain = await storeWebsite(store, category, signal).catch(() => null)
    const page = domain ? await findOnStore(domain, category, seen, signal) : null
    if (page) {
      Object.assign(filled, coverFrom(category, page), { link: page.url })
      if (!filled.price) {
        const price = priceFrom(page)
        if (price) filled.price = Math.round(price * 100)
      }
      if (category.id === 'books') filled.ref = page.url.match(/(97[89]\d{10})/)?.[1] ?? filled.ref
    } else {
      note = domain
        ? `Couldn’t find it on ${store}’s website, so the cover is from a catalogue and the link is left blank.`
        : `Couldn’t find a website for ${store}, so the link is left blank.`
    }
  } else {
    step('Finding the cover…')
  }
  await fillBlanks(category, filled, signal)
  return { filled, note }
}

// ---------------------------------------------------------------- on a shop's site

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'on', 'for', 'with', 'by'])
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))

/** The result most plainly about this title, or none if nothing is close. */
function bestMatch(results: SearchResult[], title: string, creator = ''): SearchResult | null {
  const want = words(title)
  if (!want.length) return null
  const by = words(creator).pop()
  let best: SearchResult | null = null
  let bestScore = 0
  for (const r of results) {
    const have = new Set(words(`${r.title} ${decodeURIComponent(r.url)}`))
    let score = want.filter((w) => have.has(w)).length / want.length
    if (by && have.has(by)) score += 0.2
    // A product page beats a category or search page.
    if (/\/(book|products?|p|dp|store\/products)\//.test(r.url)) score += 0.1
    if (score > bestScore) {
      best = r
      bestScore = score
    }
  }
  return bestScore >= 0.65 ? best : null
}

/** Shopify shops answer a product search as data, which is the tidy way in. */
async function shopifySearch(domain: string, query: string, signal: AbortSignal): Promise<SearchResult[]> {
  try {
    const r = await fetch(
      `https://r.jina.ai/https://${domain}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=8`,
      { signal },
    )
    const text = await r.text()
    const body = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
    const products: Array<{ title: string; url: string }> = body?.resources?.results?.products ?? []
    return products.map((p) => ({
      title: p.title,
      url: new URL(p.url, `https://${domain}`).toString().split('?')[0],
      snippet: '',
    }))
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    return []
  }
}

/** A book's page on a bookshop, tried edition by edition. */
async function bookPage(domain: string, seen: Seen, signal: AbortSignal): Promise<Page | null> {
  const address = (isbn: string) =>
    domain === 'powells.com'
      ? `https://www.powells.com/book/-${isbn}`
      : domain === 'barnesandnoble.com'
        ? `https://www.barnesandnoble.com/w/?ean=${isbn}`
        : `https://${domain}/book/${isbn}`
  const isbns = [
    ...new Set(
      [
        seen.isbn,
        ...(seen.isbns ?? []),
        ...(await bookIsbns(seen.title, seen.creator ?? '', signal)),
      ]
        .map((i) => i?.replace(/[^0-9]/g, ''))
        .filter((i): i is string => Boolean(i && i.length === 13)),
    ),
  ].slice(0, 6)
  // Two at a time: quick, without asking the reader for too much at once. An
  // edition the shop has a page for but no picture of is kept in reserve while
  // the others are tried for one that has both.
  let reserve: Page | null = null
  for (let i = 0; i < isbns.length; i += 2) {
    const batch = isbns.slice(i, i + 2)
    const pages = await Promise.all(batch.map((n) => pageExists(address(n), signal)))
    for (const [j, page] of pages.entries()) {
      if (!page) continue
      const found = { ...page, url: page.url.includes(domain) ? page.url : address(batch[j]) }
      found.image ||= await bookJacket(batch[j])
      if (found.image) return found
      reserve ??= found
    }
  }
  return reserve
}

/**
 * A book's jacket by ISBN, from the scans most American bookshops share
 * (IndieCommerce's, filed by the ISBN's last six digits) or else Open Library.
 */
async function bookJacket(isbn: string): Promise<string> {
  const candidates = [
    `https://images.booksense.com/images/${isbn.slice(-3)}/${isbn.slice(-6, -3)}/${isbn}.jpg`,
    `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  ]
  for (const url of candidates) if (await imageExists(url)) return url
  return ''
}

export async function findOnStore(
  domain: string,
  category: Category,
  seen: Seen,
  signal: AbortSignal,
): Promise<Page | null> {
  // LEGO sends a search for a set number straight to that set's page.
  if (domain === 'lego.com' && seen.detail) {
    const page = await pageExists(`https://www.lego.com/en-us/search?q=${seen.detail}`, signal)
    if (page && /\/product\//.test(page.url)) return { ...page, url: usShop(page.url) }
  }
  if (category.id === 'books') {
    const page = await bookPage(domain, seen, signal)
    if (page) return page
  }

  const query = `${seen.title} ${seen.creator ?? ''}`.trim()
  let results = await shopifySearch(domain, seen.title, signal)
  let hit = bestMatch(results, seen.title, seen.creator)
  if (!hit) {
    results = (await webSearch(`site:${domain} ${query}`, signal).catch(() => [])).filter((r) =>
      hostOf(r.url).endsWith(domain),
    )
    hit = bestMatch(results, seen.title, seen.creator)
  }
  if (!hit) return null
  const url = usShop(hit.url)
  return readPage(url, signal)
    .then((page) => ({ ...page, url }))
    .catch(() => null)
}

/**
 * The American page for a LEGO set. The reader, and search results, can land
 * on another country's shop — /nl-nl/ — with its prices and language.
 */
const usShop = (url: string) => url.replace(/lego\.com\/[a-z]{2}-[a-z]{2}\//, 'lego.com/en-us/')
