import { useState } from 'react'
import { buyLinks, tagLabel, type Category } from '../categories'
import { useCanEdit } from '../edit'
import { formatPrice } from '../price'
import { isUpcoming, longWhen, shortWhen } from '../released'
import { go } from '../route'
import type { Item } from '../types'

/**
 * An item's details without leaving the shelf: what it is, and where to buy it.
 *
 * Tapping anything on any shelf brings this up over the item itself, which
 * dims behind it — in the grid, on the bookshelf, in the crate. Nobody is
 * thrown onto another page mid-browse.
 *
 * `compact` is for the small places — a grid card, a book on the shelf — and
 * keeps to what fits: the name, the price, the shop, and what you can do
 * about it. The crate's full-size sleeve has room for the rest.
 */
export default function Peek({
  item,
  category,
  onClose,
  onRemove,
  compact = false,
}: {
  item: Item
  category: Category
  onClose: () => void
  onRemove?: (id: string) => void
  compact?: boolean
}) {
  const canEdit = useCanEdit()
  const [confirming, setConfirming] = useState(false)
  const links = buyLinks(item)
  const wants = item.status === 'wants'
  const version = !wants ? item.version : ''
  const soon = isUpcoming(item.released)
  const facts = compact
    ? [wants && item.price ? formatPrice(item.price) : item.year, version].filter(Boolean)
    : [item.year, item.detail, version, wants && item.price ? formatPrice(item.price) : ''].filter(
        Boolean,
      )

  return (
    <div className={`peek ${compact ? 'peek--compact' : ''}`}>
      <h2 className="peek__title">{item.title}</h2>
      {item.creator && <p className="peek__creator">{item.creator}</p>}
      {(facts.length > 0 || soon) && (
        <p className="peek__facts label">
          {facts.join(' · ')}
          {/* Not out yet: when it arrives, after the price, in red. */}
          {soon && (
            <span className="peek__soon">
              {facts.length > 0 ? ' · ' : ''}
              {compact ? shortWhen(item.released!) : longWhen(item.released!)}
            </span>
          )}
        </p>
      )}
      {!compact && item.tag && category.tagGroup && (
        <p className="peek__tag">
          <span className="label">{tagLabel(category, item.status)}</span>
          <span className="tagpill">{item.tag}</span>
        </p>
      )}
      {!compact && item.notes && <p className="peek__notes">{item.notes}</p>}

      {/* Nothing to go and do about something already on the shelf. */}
      {wants && links.primary.href && (
        <>
          {!compact && links.note && <p className="peek__note">{links.note}</p>}
          <a className="buy peek__buy" href={links.primary.href} target="_blank" rel="noreferrer">
            <span>
              {soon && item.preorder ? 'Pre-order · ' : ''}
              {links.primary.label}
              {!compact && item.price ? ` - ${formatPrice(item.price)}` : ''}
            </span>
            <span aria-hidden="true">&rarr;</span>
          </a>
          {!compact && links.secondary && (
            <a className="peek__second" href={links.secondary.href} target="_blank" rel="noreferrer">
              Or try {links.secondary.label} &rarr;
            </a>
          )}
        </>
      )}

      <p className="peek__links">
        {canEdit && (
          <button className="linkish" onClick={() => go(`/i/${item.id}/edit`)}>
            Edit
          </button>
        )}
        {canEdit && onRemove && (
          <button
            className={`linkish ${confirming ? 'peek__danger' : ''}`}
            onClick={() => (confirming ? onRemove(item.id) : setConfirming(true))}
          >
            {confirming ? 'Really remove?' : 'Remove'}
          </button>
        )}
        <button className="linkish" onClick={onClose}>
          Close
        </button>
      </p>
    </div>
  )
}
