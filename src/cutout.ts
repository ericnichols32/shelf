// Taking the white background off a cover image, in the browser.
//
// The method is a flood fill inwards from the four edges, clearing anything
// near-white it can reach. Doing it from the edges rather than "every white
// pixel" is the whole trick: white *inside* the picture — a sky, a logo, the
// white brick in a LEGO set — is not connected to the border, so it stays.
//
// The catch is that reading an image's pixels is something the site hosting it
// has to permit. Plenty don't, so a refused picture is fetched a second time
// through a free image service that does permit it (see `proxied`). Only if
// that fails too does this report the cut-out as blocked.

export type CutoutResult =
  | { ok: true; url: string }
  /** The host forbade reading the pixels. Nothing to be done from here. */
  | { ok: false; reason: 'blocked' }
  | { ok: false; reason: 'failed' }

/**
 * Results live for the session only.
 *
 * A cut-out PNG runs to several hundred kilobytes — far too much to keep in a
 * Firestore document or in browser storage once there are a few hundred things
 * on the shelves. Redoing the work costs about 30ms an image, and only for the
 * ones actually on screen, so it is much the cheaper side of that trade.
 */
const cache = new Map<string, CutoutResult>()

/** How far from pure white still counts as background. */
const TOLERANCE = 26

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Asking for cross-origin access makes a refusing host fail the load
    // outright — which is exactly how we learn it would have tainted us.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('blocked'))
    img.src = url
    setTimeout(() => reject(new Error('blocked')), 12000)
  })
}

function clearBackground(img: HTMLImageElement, ratio: number, fill: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  const w = canvas.width
  const h = canvas.height
  const floor = 255 - TOLERANCE
  const nearWhite = (i: number) =>
    px[i] >= floor && px[i + 1] >= floor && px[i + 2] >= floor

  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1)
  }

  while (stack.length) {
    const p = stack.pop()!
    if (seen[p]) continue
    seen[p] = 1
    const i = p * 4
    if (!nearWhite(i)) continue
    px[i + 3] = 0
    const x = p % w
    const y = (p / w) | 0
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (y > 0) stack.push(p - w)
    if (y < h - 1) stack.push(p + w)
  }

  ctx.putImageData(data, 0, 0)
  return trim(canvas, px, w, h, ratio, fill)
}

/**
 * Crop away the empty space the cut left behind.
 *
 * This is what makes a shelf of boxes look like a shelf. Stock photographs
 * frame their subject differently — one case fills the frame, the next floats
 * in a sea of white — and once that white is transparent the difference is
 * still there as empty pixels. Fitting those to a tile scales every box by a
 * different amount. Cropping to the object itself removes the variable, so
 * what reaches the page is the box and nothing else.
 */
function trim(
  canvas: HTMLCanvasElement,
  px: Uint8ClampedArray,
  w: number,
  h: number,
  ratio: number,
  fill: number,
): string {
  let top = h
  let left = w
  let right = -1
  let bottom = -1

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Anything but near-invisible counts as part of the object.
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }

  // Nothing was cleared, or everything was: leave it as it is.
  if (right < left || bottom < top) return canvas.toDataURL('image/png')

  const cutW = right - left + 1
  const cutH = bottom - top + 1

  // Ratio 0 asks for the object alone, cropped tight, with no tile around it
  // — for a place that sizes every cover to the same frame itself.
  if (ratio <= 0) {
    const tight = document.createElement('canvas')
    tight.width = cutW
    tight.height = cutH
    tight.getContext('2d')!.drawImage(canvas, left, top, cutW, cutH, 0, 0, cutW, cutH)
    return tight.toDataURL('image/png')
  }

  // Re-mount the object on a canvas the same shape as the tile it will sit in,
  // sized so that its HEIGHT is what matches from one item to the next.
  //
  // Height is the right thing to standardise on because it is what is actually
  // standard: every Blu-ray case is the same height on a real shelf. Fitting by
  // area or by width instead would leave a photograph taken at an angle — wider
  // than a flat scan of the same case — looking like a smaller object.
  const out = document.createElement('canvas')
  out.height = 1000
  out.width = Math.round(1000 * ratio)

  let drawH = out.height * fill
  let drawW = (drawH * cutW) / cutH
  // A very wide object — an angled render, a boxed set — would run off the
  // sides at full height, so it gives up some height to stay whole.
  if (drawW > out.width * fill) {
    drawW = out.width * fill
    drawH = (drawW * cutH) / cutW
  }

  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    canvas,
    left,
    top,
    cutW,
    cutH,
    (out.width - drawW) / 2,
    (out.height - drawH) / 2,
    drawW,
    drawH,
  )
  return out.toDataURL('image/png')
}

/**
 * The same picture, fetched through wsrv.nl — a free, long-running image
 * service that re-serves any public image with permission to read its pixels.
 * Hosts that refuse a cross-origin read (TMDB, most shops) can still be cut
 * out this way. Capped at 1200px, which is more than a tile ever shows.
 */
const proxied = (url: string) =>
  `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1200&h=1200&fit=inside&we`

/** The picture with its pixels readable: directly if the host allows, else proxied. */
async function loadReadable(url: string): Promise<HTMLImageElement> {
  try {
    return await load(url)
  } catch {
    if (url.startsWith('data:')) throw new Error('blocked')
    return load(proxied(url))
  }
}

export async function cutOutBackground(
  url: string,
  ratio: number,
  fill = 0.94,
): Promise<CutoutResult> {
  const key = `${url}|${ratio}|${fill}`
  const hit = cache.get(key)
  if (hit) return hit

  let result: CutoutResult
  try {
    result = { ok: true, url: clearBackground(await loadReadable(url), ratio, fill) }
  } catch (err) {
    // A tainted canvas throws on export; a refused load throws on load. Both
    // mean the same thing to anyone using this.
    result = {
      ok: false,
      reason: (err as Error)?.message === 'blocked' ? 'blocked' : 'failed',
    }
  }
  cache.set(key, result)
  return result
}

/**
 * A book's cover with any white margin around it taken away — for the
 * bookshelf, which shows every cover at the same height and its own shape.
 *
 * Shop pictures often show the book on a white page: the book in the middle,
 * white round it. That white is found by flooding in from the edges, and the
 * picture is cropped to what's left — but only when what's left is plainly a
 * book, a solid rectangle. A cover whose own design is white runs its white to
 * the edge, the flood gets into it, and what remains is a ragged shape rather
 * than a rectangle; that one is left exactly as it was. A book photographed at
 * an angle comes out as a solid shape that isn't quite a rectangle, and gets
 * its white made see-through instead of cropped. Anything that can't be read
 * comes back unchanged.
 */
const framed = new Map<string, Promise<string>>()

export function framedCover(url: string): Promise<string> {
  if (!url) return Promise.resolve(url)
  let job = framed.get(url)
  if (!job) {
    job = frame(url).catch(() => url)
    framed.set(url, job)
  }
  return job
}

async function frame(url: string): Promise<string> {
  const img = await loadReadable(url)
  const scale = Math.min(1, 700 / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data

  const floor = 255 - TOLERANCE
  const white = (p: number) =>
    px[p * 4 + 3] < 16 || (px[p * 4] >= floor && px[p * 4 + 1] >= floor && px[p * 4 + 2] >= floor)

  // Is there a margin at all? Most of the rim has to be white.
  let rimWhite = 0
  let rim = 0
  for (let x = 0; x < w; x++) {
    rim += 2
    if (white(x)) rimWhite++
    if (white((h - 1) * w + x)) rimWhite++
  }
  for (let y = 1; y < h - 1; y++) {
    rim += 2
    if (white(y * w)) rimWhite++
    if (white(y * w + w - 1)) rimWhite++
  }
  if (rimWhite < rim * 0.5) return url

  // Flood the white in from the edges.
  const out = new Uint8Array(w * h)
  const stack: number[] = []
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1)
  while (stack.length) {
    const p = stack.pop()!
    if (out[p] || !white(p)) continue
    out[p] = 1
    const x = p % w
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (p >= w) stack.push(p - w)
    if (p < w * (h - 1)) stack.push(p + w)
  }

  let top = h
  let left = w
  let right = -1
  let bottom = -1
  let solid = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (out[y * w + x]) continue
      solid++
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
  }
  if (right < left) return url
  const bw = right - left + 1
  const bh = bottom - top + 1
  // No real margin to take away.
  if (bw >= w * 0.98 && bh >= h * 0.98) return url
  const fill = solid / (bw * bh)

  const cut = document.createElement('canvas')
  const sx = img.naturalWidth / w
  const sy = img.naturalHeight / h
  cut.width = Math.round(bw * sx)
  cut.height = Math.round(bh * sy)
  const cctx = cut.getContext('2d')!

  if (fill >= 0.9) {
    // A clean rectangle: crop the original to it, keeping every pixel of the
    // cover itself, white parts included.
    cctx.drawImage(img, left * sx, top * sy, bw * sx, bh * sy, 0, 0, cut.width, cut.height)
    return cut.toDataURL('image/jpeg', 0.9)
  }
  if (fill >= 0.6) {
    // A solid shape that isn't square to the picture — a book at an angle.
    for (let p = 0; p < w * h; p++) if (out[p]) px[p * 4 + 3] = 0
    ctx.putImageData(data, 0, 0)
    cctx.drawImage(canvas, left, top, bw, bh, 0, 0, cut.width, cut.height)
    return cut.toDataURL('image/png')
  }
  // Ragged: the white was the cover's own. Leave it be.
  return url
}
