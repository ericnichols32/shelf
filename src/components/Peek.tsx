import { buyLinks, tagLabel, type Category } from '../categories'
import { useCanEdit } from '../edit'
import { formatPrice } from '../price'
import { go } from '../route'
import type { Item } from '../types'

/**
 * An item's details without leaving the shelf: what it is, and where to buy it.
 *
 * The crate and the bookshelf are for browsing, and being thrown onto another
 * page halfway through breaks that. So what the item's own page would say
 * comes up in place instead — over a record's sleeve, or under a shelf.
 */
export default function Peek({
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
    <div className="peek">
      <h2 className="peek__title">{item.title}</h2>
      {item.creator && <p className="peek__creator">{item.creator}</p>}
      {facts.length > 0 && <p className="peek__facts label">{facts.join(' · ')}</p>}
      {item.tag && category.tagGroup && (
        <p className="peek__tag">
          <span className="label">{tagLabel(category, item.status)}</span>
          <span className="tagpill">{item.tag}</span>
        </p>
      )}
      {item.notes && <p className="peek__notes">{item.notes}</p>}

      {/* Nothing to go and do about something already on the shelf. */}
      {item.status === 'wants' && links.primary.href && (
        <>
          {links.note && <p className="peek__note">{links.note}</p>}
          <a className="buy peek__buy" href={links.primary.href} target="_blank" rel="noreferrer">
            <span>
              {links.primary.label}
              {item.price ? ` - ${formatPrice(item.price)}` : ''}
            </span>
            <span aria-hidden="true">&rarr;</span>
          </a>
          {links.secondary && (
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
        <button className="linkish" onClick={onClose}>
          Close
        </button>
      </p>
    </div>
  )
}
