// Taking the white background off a cover image, in the browser.
//
// The method is a flood fill inwards from the four edges, clearing anything
// near-white it can reach. Doing it from the edges rather than "every white
// pixel" is the whole trick: white *inside* the picture — a sky, a logo, the
// white brick in a LEGO set — is not connected to the border, so it stays.
//
// The catch is that reading an image's pixels is something the site hosting it
// has to permit. Plenty don't, and there is no way around that from a browser:
// the canvas is marked tainted and refuses to be exported. So this reports
// which happened, and the form tells the truth about it.

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

function clearBackground(img: HTMLImageElement, ratio: number): string {
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
  return trim(canvas, px, w, h, ratio)
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

  const FILL = 0.94
  let drawH = out.height * FILL
  let drawW = (drawH * cutW) / cutH
  // A very wide object — an angled render, a boxed set — would run off the
  // sides at full height, so it gives up some height to stay whole.
  if (drawW > out.width * FILL) {
    drawW = out.width * FILL
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

export async function cutOutBackground(
  url: string,
  ratio: number,
): Promise<CutoutResult> {
  const key = `${url}|${ratio}`
  const hit = cache.get(key)
  if (hit) return hit

  let result: CutoutResult
  try {
    result = { ok: true, url: clearBackground(await load(url), ratio) }
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
