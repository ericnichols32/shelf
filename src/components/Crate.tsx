import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { buyLinks, tagLabel, type Category } from '../categories'
import { useCanEdit } from '../edit'
import { formatPrice } from '../price'
import { go } from '../route'
import type { Item } from '../types'
import Cover from './Cover'

/**
 * Flicking through a crate of records.
 *
 * One sleeve stands front and centre; the tops of the ones behind it show
 * above, each a little smaller and darker, the way a crate looks from above
 * and in front. Pull the front one down and it tips towards you and drops
 * away, the next one comes forward, and the one you pulled goes round to the
 * back of the pile — so the crate never runs out, it just comes round again.
 *
 * Tapping the front sleeve doesn't leave the page: the record's details and
 * its buy button come up over the artwork, which dims behind them.
 *
 * Everything hangs off one number, `pos`: how many records have been flicked
 * past. Its whole part says which sleeve is in front; its fraction says how
 * far that sleeve has been pulled. Dragging, the wheel, the arrow keys and the
 * settling after you let go all just move `pos`.
 */

/** How many sleeves show their tops behind the front one. */
const BEHIND = 6
/** How much of the first sleeve behind shows, in px; each further one shows less. */
const PEEK = 24
const SHRINK = 0.8
/** A drag this far, as a share of a sleeve's height, flicks one record. */
const PULL = 0.75

const mod = (a: number, n: number) => ((a % n) + n) % n

export default function Crate({
  category,
  items,
}: {
  category: Category
  items: Item[]
}) {
  const n = items.length
  const [pos, setPos] = useState(0)
  const posRef = useRef(0)
  const stage = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(360)
  /** Whether the front record's details are up over its artwork. */
  const [open, setOpen] = useState(false)
  const anim = useRef<number | null>(null)

  const place = useCallback((p: number) => {
    posRef.current = p
    setPos(p)
  }, [])

  /** Anything that moves the crate puts the details away again. */
  const shut = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => setSize(el.querySelector('.crate__sleeve')?.clientWidth || 360)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [n])

  const stop = () => {
    if (anim.current != null) cancelAnimationFrame(anim.current)
    anim.current = null
  }

  /** Glide to a resting place, easing out. */
  const settle = useCallback(
    (target: number) => {
      stop()
      const from = posRef.current
      const distance = target - from
      if (Math.abs(distance) < 0.001) return place(target)
      const duration = Math.min(700, 260 + Math.abs(distance) * 140)
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        place(from + distance * eased)
        anim.current = t < 1 ? requestAnimationFrame(step) : null
      }
      anim.current = requestAnimationFrame(step)
    },
    [place],
  )

  useEffect(() => stop, [])

  // ---- dragging --------------------------------------------------------------

  const drag = useRef<{
    y: number
    pos: number
    moved: boolean
    /** What was touched — the pointer is captured, so the lift can't say. */
    target: HTMLElement
    samples: Array<{ t: number; y: number }>
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (n < 2 && !(e.target as HTMLElement).closest('.crate__sleeve')) return
    stop()
    drag.current = { y: e.clientY, pos: posRef.current, moved: false, target: e.target as HTMLElement, samples: [{ t: e.timeStamp, y: e.clientY }] }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Already released (a very quick tap); the moves still arrive.
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 6) d.moved = true
    if (!d.moved || n < 2) return
    // Pulling down flicks forward. Pushing up brings the last one back from
    // the back of the pile, which is the same motion run backwards.
    shut()
    place(d.pos + dy / (size * PULL))
    d.samples.push({ t: e.timeStamp, y: e.clientY })
    if (d.samples.length > 6) d.samples.shift()
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      // A tap. On the front sleeve it opens the record; on one behind, it
      // brings that one forward.
      const sleeve = d.target.closest<HTMLElement>('[data-depth]')
      const depth = Number(sleeve?.dataset.depth ?? NaN)
      if (Number.isNaN(depth)) return
      if (depth === 0) setOpen((o) => !o)
      else {
        shut()
        settle(Math.round(posRef.current) + depth)
      }
      return
    }
    // Carry on in the direction of the flick, a record or several.
    const first = d.samples[0]
    const last = d.samples[d.samples.length - 1]
    const dt = Math.max(1, last.t - first.t)
    const velocity = (last.y - first.y) / dt / (size * PULL) // records per ms
    const projected = posRef.current + velocity * 180
    const from = Math.round(d.pos)
    // Never further than a few in one flick, and always at least one if you
    // pulled it past halfway.
    const target = Math.max(from - 4, Math.min(from + 4, Math.round(projected)))
    settle(target)
  }

  // ---- wheel and keys --------------------------------------------------------

  useEffect(() => {
    const el = stage.current
    if (!el || n < 2) return
    let idle: number | undefined
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      stop()
      shut()
      place(posRef.current + e.deltaY / (size * 1.4))
      clearTimeout(idle)
      idle = window.setTimeout(() => settle(Math.round(posRef.current)), 140)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      clearTimeout(idle)
    }
  }, [n, size, place, settle, shut])

  useEffect(() => {
    if (n < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea')) return
      if (e.key === 'Escape') shut()
      else if (e.key === 'ArrowDown' || e.key === 'j') {
        shut()
        settle(Math.round(posRef.current) + 1)
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        shut()
        settle(Math.round(posRef.current) - 1)
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n, settle, shut])

  // ---- drawing ---------------------------------------------------------------

  if (!n) return null
  const front = items[mod(Math.round(pos), n)]

  /** Where a sleeve `depth` places behind the front one sits. */
  const behindY = (depth: number) => -PEEK * ((1 - Math.pow(SHRINK, depth)) / (1 - SHRINK))

  const sleeves = items.map((item, i) => {
    // How far behind the front this one is: 0 in front, 1 next, … and between
    // -1 and 0 while it is being pulled away.
    let depth = mod(i - pos, n)
    if (depth > n - 1) depth -= n
    return { item, depth }
  })

  return (
    <div className="crate">
      <div
        className="crate__stage"
        ref={stage}
        style={{ ['--peek' as string]: `${Math.round(-behindY(BEHIND))}px` } as React.CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null
          settle(Math.round(posRef.current))
        }}
      >
        {sleeves.map(({ item, depth }) => {
          if (depth > BEHIND + 1) return null
          let style: React.CSSProperties
          if (depth >= 0) {
            const scale = 1 - 0.035 * depth
            style = {
              transform: `translate3d(-50%, ${behindY(depth)}px, 0) scale(${scale})`,
              filter: depth > 0.01 ? `brightness(${1 - 0.09 * Math.min(depth, BEHIND)})` : undefined,
              opacity: Math.max(0, Math.min(1, BEHIND + 1 - depth)),
              zIndex: 100 - Math.round(depth * 10),
            }
          } else {
            // Being pulled: it drops towards you and away, tipping forward
            // over its bottom edge as a sleeve does when you flick past it.
            const t = -depth
            style = {
              transform: `translate3d(-50%, ${t * size * 0.9}px, 0) perspective(900px) rotateX(${-t * 38}deg)`,
              opacity: 1 - Math.max(0, t - 0.55) / 0.45,
              transformOrigin: 'center bottom',
              zIndex: 101,
            }
          }
          return (
            <div
              key={item.id}
              className="crate__sleeve"
              data-depth={Math.round(depth)}
              style={style}
              aria-hidden={Math.round(depth) !== 0}
            >
              <Cover item={item} category={category} className="crate__art" />
              {open && Math.round(depth) === 0 && (
                <Details item={item} category={category} onClose={shut} />
              )}
            </div>
          )
        })}
      </div>

      <div className="crate__caption" key={front.id} aria-live="polite">
        <h2 className="crate__title">{front.title}</h2>
        {front.creator && <p className="crate__creator">{front.creator}</p>}
        <p className="crate__meta label">
          {[
            front.tag,
            front.status === 'wants' && front.price ? formatPrice(front.price) : front.year,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {n > 1 && (
          <p className="crate__count label">
            {mod(Math.round(pos), n) + 1} of {n}
            {/* Said once, on the record you land on, and not again after
                you've clearly worked it out. */}
            {Math.round(pos) === 0 && <> &middot; pull down to flick</>}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * A record's details, over its own sleeve.
 *
 * The crate is for flicking, and being thrown onto another page halfway
 * through breaks that. So everything the item's own page would say — what it
 * is, and where to buy it — comes up here instead, with the artwork dimmed
 * behind it so the words stay readable whatever the sleeve looks like.
 */
function Details({
  item,
  category,
  onClose,
}: {
  item: Item
  category: Category
  onClose: () => void
}) {
  const canEdit = useCanEdit()
  const links = buyLinks(item)
  const facts = [
    item.year,
    item.detail,
    item.status === 'wants' && item.price ? formatPrice(item.price) : '',
  ].filter(Boolean)

  return (
    <div
      className="crate__panel"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div className="crate__card" onClick={(e) => e.stopPropagation()}>
        <h2 className="crate__panel-title">{item.title}</h2>
        {item.creator && <p className="crate__panel-creator">{item.creator}</p>}
        {facts.length > 0 && <p className="crate__panel-facts label">{facts.join(' · ')}</p>}
        {item.tag && category.tagGroup && (
          <p className="crate__panel-tag">
            <span className="label">{tagLabel(category, item.status)}</span>
            <span className="tagpill">{item.tag}</span>
          </p>
        )}
        {item.notes && <p className="crate__panel-notes">{item.notes}</p>}

        {/* Nothing to go and do about a record already on the shelf. */}
        {item.status === 'wants' && links.primary.href && (
          <>
            {links.note && <p className="crate__panel-note">{links.note}</p>}
            <a className="buy crate__buy" href={links.primary.href} target="_blank" rel="noreferrer">
              <span>
                {links.primary.label}
                {item.price ? ` - ${formatPrice(item.price)}` : ''}
              </span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </>
        )}

        <p className="crate__panel-links">
          {canEdit && (
            <button className="linkish" onClick={() => go(`/i/${item.id}/edit`)}>
              Edit
            </button>
          )}
          <button className="linkish" onClick={onClose}>
            Close
          </button>
        </p>
      </div>
    </div>
  )
}
