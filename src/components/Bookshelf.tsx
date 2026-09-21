import { useEffect, useRef, useState } from 'react'
import { tagTabLabel, type Category } from '../categories'
import { knownSpine, spineFor, type Spine } from '../spinecolor'
import type { Item } from '../types'
import Cover from './Cover'
import Peek from './Peek'

/**
 * Books on shelves, spine out.
 *
 * A shelf for each kind. The books stand side by side the way they do on a
 * real one, showing their spines — each in its own cover's colour, title
 * running down it — and a little uneven in height and thickness, as books
 * are. One book on each shelf stands face-out. Tap a spine and that book turns
 * round to face you; tap the face-out book and its details, with the buy
 * button, come up under the shelf. Each shelf scrolls sideways with the
 * phone's own swipe; up and down moves between shelves.
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
  // Anything not yet given a kind still needs somewhere to stand.
  const loose = items.filter((i) => !order.includes(i.tag))
  if (loose.length) rows.push({ key: '', label: 'Not sorted yet', items: loose })

  return (
    <div className="bookshelf">
      {rows
        .filter((row) => row.items.length > 0)
        .map((row) => (
          <Shelf key={row.key} label={row.label} items={row.items} category={category} />
        ))}
    </div>
  )
}

/**
 * A steady variety for each book, from its id: the same book is always the
 * same thickness and height, and neighbours differ the way real ones do.
 */
function build(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return {
    width: 24 + (h % 13), // 24–36px thick
    height: 0.84 + ((h >> 5) % 17) / 100, // 84–100% of the shelf
  }
}

function Shelf({
  label,
  items,
  category,
}: {
  label: string
  items: Item[]
  category: Category
}) {
  const [facing, setFacing] = useState(items[0]?.id ?? '')
  const [open, setOpen] = useState(false)
  const rail = useRef<HTMLDivElement>(null)

  // If the face-out book leaves the shelf, the first one takes its place.
  const front = items.find((i) => i.id === facing) ?? items[0]

  // Keep the face-out book in view once it has turned round.
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>(`[data-id="${front.id}"]`)
    const t = setTimeout(
      () => el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }),
      380,
    )
    return () => clearTimeout(t)
  }, [front.id])

  return (
    <section className="case" aria-label={label}>
      <h2 className="case__label label">
        {label}
        <span className="case__count">{items.length}</span>
      </h2>

      <div className="case__rail" ref={rail}>
        {items.map((item) =>
          item.id === front.id ? (
            <button
              key={item.id}
              data-id={item.id}
              className="case__face"
              aria-label={`${item.title} — ${open ? 'hide' : 'show'} details`}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <Cover item={item} category={category} className="case__cover" tight />
            </button>
          ) : (
            <SpineButton key={item.id} item={item} onClick={() => setFacing(item.id)} />
          ),
        )}
      </div>

      {open ? (
        <div className="case__details">
          <Peek item={front} category={category} onClose={() => setOpen(false)} />
        </div>
      ) : (
        <div className="case__caption" key={front.id}>
          <p className="case__title">{front.title}</p>
          {front.creator && <p className="case__creator">{front.creator}</p>}
        </div>
      )}
    </section>
  )
}

function SpineButton({ item, onClick }: { item: Item; onClick: () => void }) {
  const [spine, setSpine] = useState<Spine | null>(() => knownSpine(item.cover))
  useEffect(() => {
    if (spine) return
    let live = true
    spineFor(item.cover).then((s) => live && setSpine(s))
    return () => {
      live = false
    }
  }, [item.cover, spine])

  const { width, height } = build(item.id)
  return (
    <button
      data-id={item.id}
      className={`spine ${spine ? '' : 'spine--waiting'}`}
      style={
        {
          '--w': `${width}px`,
          '--h': height,
          '--spine-paper': spine?.paper,
          '--spine-ink': spine?.ink,
        } as React.CSSProperties
      }
      onClick={onClick}
      aria-label={`${item.title}${item.creator ? `, ${item.creator}` : ''}`}
    >
      <span className="spine__title">{item.title}</span>
    </button>
  )
}
