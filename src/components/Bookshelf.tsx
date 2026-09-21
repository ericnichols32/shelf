import { useState } from 'react'
import { tagTabLabel, type Category } from '../categories'
import type { Item } from '../types'
import Cover from './Cover'
import Peek from './Peek'

/**
 * Books in rows, a row for each kind.
 *
 * Every cover flat, the same size and evenly spaced, with its title and
 * author under it — the way Apple Books lays out a shelf. Each row scrolls
 * sideways with the phone's own swipe and momentum, the next cover peeking in
 * from the edge to say there's more; up and down moves between rows. Tap a
 * cover and its details, with the buy button, come up under that row.
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

function Shelf({
  label,
  items,
  category,
}: {
  label: string
  items: Item[]
  category: Category
}) {
  /** The book whose details are showing under the row, if any. */
  const [openId, setOpenId] = useState<string | null>(null)
  const open = items.find((i) => i.id === openId)

  return (
    <section className="case" aria-label={label}>
      <h2 className="case__label label">
        {label}
        <span className="case__count">{items.length}</span>
      </h2>

      <div className="case__rail">
        {items.map((item) => (
          <button
            key={item.id}
            className="case__book"
            aria-expanded={item.id === openId}
            data-open={item.id === openId || undefined}
            onClick={() => setOpenId((id) => (id === item.id ? null : item.id))}
          >
            <Cover item={item} category={category} className="case__cover" tight />
            <span className="case__title">{item.title}</span>
            {item.creator && <span className="case__creator">{item.creator}</span>}
          </button>
        ))}
      </div>

      {open && (
        <div className="case__details" key={open.id}>
          <Peek item={open} category={category} onClose={() => setOpenId(null)} />
        </div>
      )}
    </section>
  )
}
