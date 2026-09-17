// Finding cover art, without asking anyone to type a URL.
//
// Four of the five shelves have a free source that a browser is allowed to call
// directly. Switch games do not: Nintendo publishes no open catalogue, and
// their site refuses cross-origin requests, so those covers stay manual.
//
// Everything here fails quietly. A lookup that finds nothing leaves the form
// exactly as the typist left it — this fills blanks in, it never overwrites.

import type { CategoryId } from './types'

export interface Found {
  cover?: string
  year?: string
  creator?: string
  /** A catalogue number worth keeping: an ISBN, so far. */
  ref?: string
}

export type LookupState =
  | { phase: 'idle' }
  | { phase: 'looking' }
  | { phase: 'found'; source: string }
  | { phase: 'missing'; source: string }

const TMDB_TOKEN = import.meta.env.VITE_TMDB_TOKEN

interface Query {
  title: string
  creator: string
  detail: string
}

async function json(url: string, signal: AbortSignal, headers?: HeadersInit) {
  const r = await fetch(url, { signal, headers })
  if (!r.ok) return null
  return r.json()
}

/** Does this image URL actually resolve? The CDNs below 404 rather than lie. */
function imageExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    const done = (ok: boolean) => resolve(ok)
    img.onload = () => done(img.naturalWidth > 1)
    img.onerror = () => done(false)
    img.src = url
    setTimeout(() => done(false), 8000)
  })
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** iTunes returns the whole discography; take the one actually asked for. */
function bestByTitle<T>(rows: T[], title: string, name: (row: T) => string) {
  const wanted = norm(title)
  return (
    rows.find((r) => norm(name(r)) === wanted) ??
    rows.find((r) => norm(name(r)).startsWith(wanted)) ??
    rows[0]
  )
}

async function vinyl(qy: Query, signal: AbortSignal): Promise<Found | null> {
  const term = encodeURIComponent(`${qy.title} ${qy.creator}`.trim())
  const data = await json(
    `https://itunes.apple.com/search?term=${term}&entity=album&limit=8`,
    signal,
  )
  const results: Array<{
    collectionName: string
    artistName: string
    releaseDate?: string
    artworkUrl100?: string
  }> = data?.results ?? []
  if (!results.length) return null
  const hit = bestByTitle(results, qy.title, (r) => r.collectionName)
  if (!hit?.artworkUrl100) return null
  return {
    // The API hands back a thumbnail; the same path serves any size.
    cover: hit.artworkUrl100.replace(/\/\d+x\d+bb\.jpg$/, '/600x600bb.jpg'),
    year: hit.releaseDate?.slice(0, 4),
    creator: hit.artistName,
  }
}

async function bluray(qy: Query, signal: AbortSignal): Promise<Found | null> {
  if (!TMDB_TOKEN) return null
  const headers = { Authorization: `Bearer ${TMDB_TOKEN}` }
  const data = await json(
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(qy.title)}&language=en-US`,
    signal,
    headers,
  )
  const hit = data?.results?.[0]
  if (!hit?.poster_path) return null

  // One more call for the director, which is the field this shelf asks for.
  let director: string | undefined
  const credits = await json(
    `https://api.themoviedb.org/3/movie/${hit.id}/credits`,
    signal,
    headers,
  ).catch(() => null)
  const crew: Array<{ job: string; name: string }> = credits?.crew ?? []
  director = crew.find((c) => c.job === 'Director')?.name

  return {
    cover: `https://image.tmdb.org/t/p/w780${hit.poster_path}`,
    year: hit.release_date?.slice(0, 4),
    creator: director,
  }
}

async function books(qy: Query, signal: AbortSignal): Promise<Found | null> {
  const term = encodeURIComponent(`${qy.title} ${qy.creator}`.trim())
  const data = await json(
    `https://openlibrary.org/search.json?q=${term}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,isbn`,
    signal,
  )
  const docs: Array<{
    key?: string
    title: string
    author_name?: string[]
    first_publish_year?: number
    cover_i?: number
    isbn?: string[]
  }> = data?.docs ?? []
  if (!docs.length) return null
  const hit = bestByTitle(docs, qy.title, (d) => d.title)
  if (!hit) return null

  return {
    cover: hit.cover_i
      ? `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`
      : undefined,
    year: hit.first_publish_year ? String(hit.first_publish_year) : undefined,
    creator: hit.author_name?.[0],
    ref: await printIsbn(hit.key, hit.isbn, signal),
  }
}

/**
 * The ISBN most likely to be a book McNally Jackson actually has a page for.
 *
 * Their product pages are keyed on ISBN, so the edition matters: the ebook and
 * the British printing both 404. This prefers a physical edition, and among
 * those one published in the US, which is the best a free catalogue allows —
 * it is a good guess rather than a guarantee, which is why the item page keeps
 * a Bookshop link underneath that always resolves.
 */
async function printIsbn(
  workKey: string | undefined,
  fallback: string[] | undefined,
  signal: AbortSignal,
): Promise<string | undefined> {
  const first = fallback?.find((i) => i.length === 13) ?? fallback?.[0]
  if (!workKey) return first

  const data = await json(
    `https://openlibrary.org${workKey}/editions.json?limit=50`,
    signal,
  ).catch(() => null)
  const entries: Array<{
    isbn_13?: string[]
    physical_format?: string
    publish_country?: string
    publish_places?: Array<{ name?: string } | string>
  }> = data?.entries ?? []

  const printed = entries.filter(
    (e) =>
      e.isbn_13?.length &&
      e.physical_format &&
      !/e-?book|audio|digital/i.test(e.physical_format),
  )
  if (!printed.length) return first

  const isUs = (e: (typeof printed)[number]) => {
    if (e.publish_country) return /^(nyu|xxu|cau|mau|ilu|pau)/.test(e.publish_country)
    const places = (e.publish_places ?? []).map((pl) =>
      typeof pl === 'string' ? pl : (pl?.name ?? ''),
    )
    return places.some((pl) => /new york|boston|chicago|u\.?s\.?a?\b/i.test(pl))
  }

  // 978-0 and 978-1 are the English-language registration groups, so they rule
  // out the Italian and German printings that otherwise come back first.
  const english = (e: (typeof printed)[number]) =>
    /^97[89][01]/.test(e.isbn_13?.[0] ?? '')

  const chosen =
    printed.find((e) => isUs(e) && english(e)) ??
    printed.find(isUs) ??
    printed.find(english) ??
    printed[0]
  return chosen.isbn_13?.[0] ?? first
}

async function lego(qy: Query): Promise<Found | null> {
  // Keyed on the set number, which is the only thing that identifies a set.
  const num = (qy.detail || qy.title).trim().replace(/[^0-9]/g, '')
  if (num.length < 4) return null
  const candidates = [
    `https://cdn.rebrickable.com/media/sets/${num}-1.jpg`,
    `https://img.bricklink.com/ItemImage/SN/0/${num}-1.png`,
  ]
  for (const url of candidates) {
    if (await imageExists(url)) return { cover: url }
  }
  return null
}

/** What each shelf keys its lookup on, so the form knows when to go again. */
export function lookupKey(category: CategoryId, q: Query): string {
  if (category === 'lego') return q.detail.trim()
  return `${q.title.trim()}|${q.creator.trim()}`
}

const SOURCES: Record<CategoryId, string> = {
  vinyl: 'Apple Music',
  bluray: 'TMDB',
  books: 'Open Library',
  lego: 'Rebrickable',
  switch: '',
}

export function canLookUp(category: CategoryId): boolean {
  if (category === 'switch') return false
  if (category === 'bluray') return Boolean(TMDB_TOKEN)
  return true
}

export async function lookup(
  category: CategoryId,
  q: Query,
  signal: AbortSignal,
): Promise<{ found: Found | null; source: string }> {
  const source = SOURCES[category]
  try {
    switch (category) {
      case 'vinyl':
        return { found: await vinyl(q, signal), source }
      case 'bluray':
        return { found: await bluray(q, signal), source }
      case 'books':
        return { found: await books(q, signal), source }
      case 'lego':
        return { found: await lego(q), source }
      default:
        return { found: null, source }
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    console.error('Cover lookup failed.', err)
    return { found: null, source }
  }
}
