// Reading other websites from inside the browser.
//
// A web page can't normally fetch another site's pages — browsers forbid it
// unless that site opts in, and shops don't. So pages are read through Jina's
// free reader (r.jina.ai), which fetches a page on our behalf and hands back
// its HTML with permission to read it. No key and no account; it allows about
// twenty pages a minute, which is far more than adding one thing at a time
// needs. Microlink, another free service, stands in if Jina is having a bad day.
//
// Searching goes the same way: DuckDuckGo's plain-HTML results page, read
// through the same reader.

const READER = 'https://r.jina.ai/'

export interface Page {
  url: string
  title: string
  description: string
  image: string
  author: string
  /** Product details the shop publishes for search engines, trimmed. */
  structured: string
  /** The words on the page, trimmed — enough to find a director or a year. */
  text: string
}

async function throughReader(url: string, signal: AbortSignal): Promise<string> {
  const r = await fetch(READER + url, {
    signal,
    headers: { 'X-Return-Format': 'html' },
  })
  if (r.status === 429) {
    throw new Error('The page reader is busy — wait a minute and try again.')
  }
  if (!r.ok) throw new Error(`Couldn't read that page (${r.status}).`)
  return r.text()
}

const meta = (doc: Document, ...names: string[]): string => {
  for (const n of names) {
    const el =
      doc.querySelector(`meta[property="${n}"]`) ??
      doc.querySelector(`meta[name="${n}"]`)
    const v = el?.getAttribute('content')?.trim()
    if (v) return v
  }
  return ''
}

/** The schema.org blocks a shop writes for Google, which name things plainly. */
function structuredData(doc: Document): unknown[] {
  const out: unknown[] = []
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(s.textContent ?? '')
      const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] ?? [parsed])
      out.push(...list)
    } catch {
      // A shop's malformed block is its own problem; skip it.
    }
  }
  const useful = /product|book|movie|music|album|game|creativework|offer/i
  return out.filter((o) => useful.test(JSON.stringify((o as { '@type'?: unknown })?.['@type'] ?? '')))
}

function imageFrom(ld: unknown[]): string {
  for (const o of ld as Array<{ image?: unknown }>) {
    const img = o.image
    if (typeof img === 'string' && img) return img
    if (Array.isArray(img) && typeof img[0] === 'string') return img[0]
    if (img && typeof img === 'object' && 'url' in img) return String((img as { url: unknown }).url)
  }
  return ''
}

function absolute(href: string, base: string): string {
  try {
    return new URL(href, base).toString()
  } catch {
    return ''
  }
}

/**
 * Pictures a shop puts in a page's preview when it has nothing better — its
 * own logo, mostly. A small bookshop's page for an edition without a scan
 * offers exactly that, and it would otherwise become the book's cover.
 */
const NOT_A_COVER = /logo|favicon|banner|placeholder|no[-_]?image|default[-_]?(image|cover)|social[-_]?share/i

export function parsePage(html: string, url: string): Page {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const ld = structuredData(doc)
  for (const el of doc.querySelectorAll('script, style, noscript, svg, nav, footer, header')) {
    el.remove()
  }
  const text = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const canonical =
    meta(doc, 'og:url') || doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''
  const image = [meta(doc, 'og:image', 'og:image:secure_url', 'twitter:image'), imageFrom(ld)].find(
    (src) => src && !NOT_A_COVER.test(src),
  )

  return {
    url: absolute(canonical, url) || url,
    title: meta(doc, 'og:title', 'twitter:title') || doc.title.trim(),
    description: meta(doc, 'og:description', 'description', 'twitter:description'),
    // An http picture on an https page is blocked by the browser.
    image: image ? absolute(image, url).replace(/^http:/, 'https:') : '',
    author: meta(doc, 'author', 'book:author', 'music:musician'),
    structured: JSON.stringify(ld).slice(0, 4000),
    text: text.slice(0, 5000),
  }
}

/** Microlink's reading of a page: less detail, but a second opinion. */
async function viaMicrolink(url: string, signal: AbortSignal): Promise<Page> {
  const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal })
  const body = await r.json()
  if (body?.status !== 'success') throw new Error("Couldn't read that page.")
  const d = body.data ?? {}
  return {
    url: d.url || url,
    title: d.title ?? '',
    description: d.description ?? '',
    image: d.image?.url ?? '',
    author: d.author ?? '',
    structured: '',
    text: d.description ?? '',
  }
}

/**
 * A shop page, read. Throws if neither reader could get it.
 *
 * A page with no title and no picture counts as not found — that is what a
 * shop's "sorry, no such book" page looks like from here.
 */
export async function readPage(url: string, signal: AbortSignal): Promise<Page> {
  let page: Page | null = null
  try {
    page = parsePage(await throughReader(url, signal), url)
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
  }
  if (!page || !(page.image || page.structured.length > 2)) {
    page = await viaMicrolink(url, signal)
  }
  if (NOT_FOUND.test(page.title)) throw new Error('No such page.')
  return page
}

/** What a shop's missing-page title looks like. */
const NOT_FOUND = /^(404\b|page not found|not found\b)|\b404 not found\b/i

/** Does this address lead to a real product page? Used before trusting a guess. */
export async function pageExists(url: string, signal: AbortSignal): Promise<Page | null> {
  let page: Page
  try {
    page = parsePage(await throughReader(url, signal), url)
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    // Jina busy or refused: ask Microlink instead.
    try {
      page = await viaMicrolink(url, signal)
    } catch (again) {
      if ((again as Error)?.name === 'AbortError') throw again
      return null
    }
  }
  // A missing book on a bookshop's site still returns a page, titled with
  // nothing but the shop's name: "| McNally Jackson Books".
  const named = page.title.split('|')[0].trim().length > 1
  return named && !NOT_FOUND.test(page.title) ? page : null
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

/** A DuckDuckGo search, ads left out. */
export async function webSearch(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const html = await throughReader(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    signal,
  )
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: SearchResult[] = []
  for (const result of doc.querySelectorAll('.result')) {
    if (result.classList.contains('result--ad')) continue
    const a = result.querySelector<HTMLAnchorElement>('a.result__a')
    if (!a) continue
    const href = a.getAttribute('href') ?? ''
    // Results link through DuckDuckGo's redirect; the real address is inside.
    const real = new URLSearchParams(href.split('?')[1] ?? '').get('uddg') ?? href
    if (!/^https?:/.test(real)) continue
    out.push({
      title: a.textContent?.trim() ?? '',
      url: real,
      snippet: result.querySelector('.result__snippet')?.textContent?.trim() ?? '',
    })
  }
  return out
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^(www|webmail|shop|store)\./, '')
  } catch {
    return ''
  }
}

export const looksLikeUrl = (s: string): boolean =>
  /^(https?:\/\/|www\.)\S+\.\S+$/i.test(s.trim())

export const asUrl = (s: string): string =>
  /^https?:\/\//i.test(s.trim()) ? s.trim() : `https://${s.trim()}`
