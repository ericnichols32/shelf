// A book's spine colour, taken from its cover.
//
// A real spine is almost always printed in the cover's main colour, so that is
// what's used: the cover is shrunk to a few hundred pixels, near-white and
// see-through pixels are ignored, and the commonest remaining colour — with
// vivid colours counting for a little more than greys — wins. Worked out once
// per cover and remembered on this device.

import { loadReadable } from './cutout'

export interface Spine {
  /** The spine's colour. */
  paper: string
  /** A title colour that reads on it. */
  ink: string
}

const FALLBACK: Spine = { paper: 'var(--sand-deep)', ink: 'var(--ink)' }
const MEMORY_KEY = 'shelf.spines.v2'
const memory = new Map<string, Spine>()
const pending = new Map<string, Promise<Spine>>()

function saved(): Record<string, Spine> {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function save(url: string, spine: Spine) {
  try {
    const all = saved()
    all[url] = spine
    localStorage.setItem(MEMORY_KEY, JSON.stringify(all))
  } catch {
    // Worked out again next visit; no harm.
  }
}

/** What's already known, without waiting. */
export function knownSpine(url: string): Spine | null {
  if (!url) return FALLBACK
  return memory.get(url) ?? saved()[url] ?? null
}

export function spineFor(url: string): Promise<Spine> {
  if (!url) return Promise.resolve(FALLBACK)
  const known = knownSpine(url)
  if (known) return Promise.resolve(known)
  let job = pending.get(url)
  if (!job) {
    job = work(url).then((spine) => {
      memory.set(url, spine)
      if (spine !== FALLBACK) save(url, spine)
      return spine
    })
    pending.set(url, job)
  }
  return job
}

async function work(url: string): Promise<Spine> {
  try {
    const img = await loadReadable(url)
    const size = 28
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, size, size)
    const px = ctx.getImageData(0, 0, size, size).data

    // Buckets of similar colour, weighted towards the vivid.
    const buckets = new Map<number, { weight: number; r: number; g: number; b: number; n: number }>()
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]]
      if (a < 128) continue
      if (r > 238 && g > 238 && b > 238) continue
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const saturation = max ? (max - min) / max : 0
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
      const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0, n: 0 }
      // Near-black counts for less: plenty of covers have a dark photograph
      // behind the title, and a shelf of black spines tells you nothing.
      bucket.weight += (0.35 + saturation) * (max < 40 ? 0.3 : 1)
      bucket.r += r
      bucket.g += g
      bucket.b += b
      bucket.n++
      buckets.set(key, bucket)
    }
    let best: { weight: number; r: number; g: number; b: number; n: number } | null = null
    for (const bucket of buckets.values()) if (!best || bucket.weight > best.weight) best = bucket
    if (!best) return FALLBACK

    const r = Math.round(best.r / best.n)
    const g = Math.round(best.g / best.n)
    const b = Math.round(best.b / best.n)
    const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
    return { paper: `rgb(${r}, ${g}, ${b})`, ink: light ? '#2b2621' : '#f7f1e8' }
  } catch {
    return FALLBACK
  }
}
