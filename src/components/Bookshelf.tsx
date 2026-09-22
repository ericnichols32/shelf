import { useEffect, useState } from 'react'
import { tagTabLabel, type Category } from '../categories'
import type { Item } from '../types'
import { framedCover } from '../cutout'
import Peek from './Peek'

/**
 * Books in rows, a row for each kind.
 *
 * Every cover flat, evenly spaced, with its title and author under it — the
 * way Apple Books lays out a shelf. Covers share a height and keep their own
 * shape, so nothing is cropped, and any white margin a shop's photo left
 * round a book is trimmed away first. Each row scrolls
 * sideways with the phone's own swipe and momentum, the next cover peeking in
 * from the edge to say there's more; up and down moves between rows. Tap a
 * cover and its details, with the buy button, come up over it.
 */
export default function Bookshelf({
  category,
  items,
  onRemove,
}: {
  category: Category
  items: Item[]
  onRemove?: (id: string) => void
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
          <Shelf
            key={row.key}
            label={row.label}
            items={row.items}
            category={category}
            onRemove={onRemove}
          />
        ))}
    </div>
  )
}

function Shelf({
  label,
  items,
  category,
  onRemove,
}: {
  label: string
  items: Item[]
  category: Category
  onRemove?: (id: string) => void
}) {
  /** The book showing its details over its cover, if any. */
  const [openId, setOpenId] = useState<string | null>(null)
  const toggle = (id: string) => setOpenId((open) => (open === id ? null : id))

  return (
    <section className="case" aria-label={label}>
      <h2 className="case__label label">
        {label}
        <span className="case__count">{items.length}</span>
      </h2>

      <div className="case__rail">
        {items.map((item) => (
          <div key={item.id} className="case__book" data-open={item.id === openId || undefined}>
            <button
              className="case__hit"
              aria-expanded={item.id === openId}
              onClick={() => toggle(item.id)}
            >
              <BookCover item={item} />
              <span className="case__title">{item.title}</span>
              {item.creator && <span className="case__creator">{item.creator}</span>}
            </button>
            {item.id === openId && (
              <div
                className="peekover case__peek"
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('a, button')) toggle(item.id)
                }}
              >
                <Peek
                  item={item}
                  category={category}
                  onClose={() => toggle(item.id)}
                  onRemove={onRemove}
                  compact
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * A cover at the shelf's height and its own width, with any white margin
 * taken off (see framedCover). The plain picture shows first and the trimmed
 * one replaces it when ready, usually a moment later.
 */
function BookCover({ item }: { item: Item }) {
  const [src, setSrc] = useState(item.cover)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    let live = true
    framedCover(item.cover).then((framed) => live && setSrc(framed))
    return () => {
      live = false
    }
  }, [item.cover])

  if (!item.cover || broken) {
    return (
      <span className="case__cover case__cover--blank">
        <span className="case__blank-title">{item.title}</span>
      </span>
    )
  }
  return (
    <img
      className="case__cover"
      src={src}
      alt={item.title}
      loading="lazy"
      draggable={false}
      onError={() => (src !== item.cover ? setSrc(item.cover) : setBroken(true))}
    />
  )
}
