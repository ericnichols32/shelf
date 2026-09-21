import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tagTabLabel, type Category } from '../categories'
import type { Item } from '../types'
import Cover from './Cover'
import Peek from './Peek'

/**
 * Books on shelves: a row for each kind, slid along sideways.
 *
 * Each row stands its books on a plank. The one in the middle faces you; the
 * rest turn away to either side, the further out the more, the way a row of
 * books looks when you walk along it. Slide a row with your thumb and the
 * next book comes round to face you. Up and down stays the page's — that is
 * how you get from one shelf to the next.
 *
 * Tap the book in the middle and its details, with the buy button, come up
 * under the shelf; tap any other and it slides round to the middle.
 */
export default function Bookshelf({
  category,
  items,
}: {
  category: Category
  items: Item[]
}) {
  const order = category.shelfRows ?? category.tagGroup?.options ?? []
  const rows = order.map((tag) => ({
    key: tag,
    label: tagTabLabel(category, tag),
    items: items.filter((i) => i.tag === tag),
  }))
  // Anything not yet given a kind still needs a place to stand.
  const loose = items.filter((i) => !order.includes(i.tag))
  if (loose.length) rows.push({ key: '', label: 'Not sorted yet', items: loose })

  return (
    <div className="bookshelf">
      {rows
        .filter((row) => row.items.length > 0)
        .map((row) => (
          <ShelfRow
            // A different set of books starts the row again from its first.
            key={`${row.key}|${row.items.map((i) => i.id).join()}`}
            label={row.label}
            items={row.items}
            category={category}
          />
        ))}
    </div>
  )
}

/** How many books show to either side of the middle one. */
const SIDE = 5

function ShelfRow({
  label,
  items,
  category,
}: {
  label: string
  items: Item[]
  category: Category
}) {
  const n = items.length
  const [pos, setPos] = useState(0)
  const posRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [moving, setMoving] = useState(false)
  const [width, setWidth] = useState(120)
  const stage = useRef<HTMLDivElement>(null)
  const anim = useRef<number | null>(null)

  const place = useCallback((p: number) => {
    posRef.current = p
    setPos(p)
  }, [])

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => setWidth(el.querySelector('.bookrow__book')?.clientWidth || 120)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const stop = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current)
    anim.current = null
  }
  useEffect(() => stop, [])

  const clampIndex = (i: number) => Math.max(0, Math.min(n - 1, i))

  const settle = useCallback(
    (target: number) => {
      stop()
      const from = posRef.current
      const distance = target - from
      if (Math.abs(distance) < 0.001) {
        setMoving(false)
        return place(target)
      }
      const duration = Math.min(650, 240 + Math.abs(distance) * 110)
      const start = performance.now()
      setMoving(true)
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        place(from + distance * (1 - Math.pow(1 - t, 3)))
        anim.current = t < 1 ? requestAnimationFrame(step) : null
        if (t >= 1) setMoving(false)
      }
      anim.current = requestAnimationFrame(step)
    },
    [place],
  )

  /** A drag this far sideways moves one book along. */
  const stepPx = width * 0.55

  // ---- dragging --------------------------------------------------------------

  const drag = useRef<{
    x: number
    y: number
    pos: number
    /** Sideways is ours; up and down is the page's, and ends it. */
    mode: 'undecided' | 'slide' | 'page'
    target: HTMLElement
    samples: Array<{ t: number; x: number }>
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    stop()
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      pos: posRef.current,
      mode: 'undecided',
      target: e.target as HTMLElement,
      samples: [{ t: e.timeStamp, x: e.clientX }],
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.mode === 'page') return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (d.mode === 'undecided') {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return
      d.mode = Math.abs(dx) > Math.abs(dy) ? 'slide' : 'page'
      if (d.mode === 'page') return
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        // Fine without it.
      }
    }
    setMoving(true)
    // Past either end the shelf gives a little, then stops.
    let p = d.pos - dx / stepPx
    if (p < 0) p *= 0.3
    if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.3
    place(p)
    d.samples.push({ t: e.timeStamp, x: e.clientX })
    if (d.samples.length > 6) d.samples.shift()
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.mode === 'undecided') {
      // A tap. The middle book opens its details or puts them away; any
      // other slides round to the middle. Links inside the details are theirs.
      if (d.target.closest('a, button')) return
      const book = d.target.closest<HTMLElement>('[data-index]')
      if (!book) return
      const index = Number(book.dataset.index)
      if (index === Math.round(posRef.current)) setOpen((o) => !o)
      else settle(index)
      return
    }
    if (d.mode === 'page') return
    const first = d.samples[0]
    const last = d.samples[d.samples.length - 1]
    const velocity = (last.x - first.x) / Math.max(1, last.t - first.t) / stepPx
    settle(clampIndex(Math.round(posRef.current - velocity * 200)))
  }

  const onPointerCancel = () => {
    // The page took the gesture (a scroll); leave the row where it rests.
    drag.current = null
    settle(clampIndex(Math.round(posRef.current)))
  }

  // A trackpad's sideways swipe slides the row; an up-and-down one is left
  // alone to scroll the page.
  useEffect(() => {
    const el = stage.current
    if (!el || n < 2) return
    let idle: number | undefined
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      stop()
      setMoving(true)
      place(Math.max(-0.3, Math.min(n - 0.7, posRef.current + e.deltaX / (stepPx * 1.2))))
      clearTimeout(idle)
      idle = window.setTimeout(() => settle(clampIndex(Math.round(posRef.current))), 140)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(idle)
    }
    // clampIndex only reads n, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, stepPx, place, settle])

  // ---- drawing ---------------------------------------------------------------

  const middle = clampIndex(Math.round(pos))
  const front = items[middle]

  return (
    <section className="bookrow" aria-label={label}>
      <h2 className="bookrow__label label">
        {label}
        <span className="bookrow__count">{n}</span>
      </h2>

      <div
        className="bookrow__stage"
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {items.map((item, i) => {
          const d = i - pos
          const a = Math.abs(d)
          if (a > SIDE + 1) return null
          const sign = Math.sign(d)
          const near = Math.min(a, 1)
          const far = Math.max(a - 1, 0)
          // Out from the middle: a big step to clear the book facing you, then
          // closer together, the way books turned side-on stand.
          const x = sign * (near * width * 0.74 + far * width * 0.3)
          const turn = sign * near * 56
          const back = -(near * 110 + far * 18)
          const isFront = i === middle
          return (
            <div
              key={item.id}
              className="bookrow__book"
              data-index={i}
              aria-hidden={!isFront}
              style={{
                transform: `translateX(calc(-50% + ${x}px)) translateZ(${back}px) rotateY(${turn}deg)`,
                zIndex: 100 - Math.round(a * 10),
                filter:
                  isFront && open && !moving
                    ? 'brightness(0.62)'
                    : a > 0.02
                      ? `brightness(${1 - Math.min(a, 4) * 0.08})`
                      : undefined,
                opacity: Math.max(0, Math.min(1, SIDE + 1 - a)),
              }}
            >
              <Cover item={item} category={category} className="bookrow__art" />
            </div>
          )
        })}
      </div>
      <div className="bookrow__plank" aria-hidden="true" />

      {open && !moving ? (
        <div className="bookrow__details">
          <Peek item={front} category={category} onClose={() => setOpen(false)} />
        </div>
      ) : (
        <div className="bookrow__caption" key={front.id}>
          <p className="bookrow__title">{front.title}</p>
          {front.creator && <p className="bookrow__creator">{front.creator}</p>}
        </div>
      )}
    </section>
  )
}
