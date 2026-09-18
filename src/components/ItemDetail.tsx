import { useState } from 'react'
import { buyLinks, byId, tagLabel } from '../categories'
import { go } from '../route'
import { useCanEdit } from '../edit'
import type { Item } from '../types'
import Cover from './Cover'
import { formatPrice } from '../price'

export default function ItemDetail({
  item,
  siblings,
  onRemove,
}: {
  item: Item
  /** The rest of the list this came from, in the order the feed shows it. */
  siblings: Item[]
  onRemove: (id: string) => void
}) {
  const canEdit = useCanEdit()
  const [confirming, setConfirming] = useState(false)
  const category = byId(item.category)
  if (!category) return null

  const wants = item.status === 'wants'

  // Stepping through a shelf without going back to it each time. The list is
  // the one behind you — same shelf, same side, same order — so the arrows
  // move the way the feed reads.
  const here = siblings.findIndex((i) => i.id === item.id)
  const previous = here > 0 ? siblings[here - 1] : null
  const next = here >= 0 && here < siblings.length - 1 ? siblings[here + 1] : null
  const links = buyLinks(item)

  return (
    <article className="detail">
      {(previous || next) && (
        <nav className="stepper" aria-label="Move through the shelf">
          <button
            className="stepper__arrow"
            disabled={!previous}
            aria-label="Previous"
            onClick={() => previous && go(`/i/${previous.id}`)}
          >
            &larr;
          </button>
          <span className="stepper__where label">
            {here + 1} of {siblings.length}
          </span>
          <button
            className="stepper__arrow"
            disabled={!next}
            aria-label="Next"
            onClick={() => next && go(`/i/${next.id}`)}
          >
            &rarr;
          </button>
        </nav>
      )}

      <Cover item={item} category={category} className="detail__art" />

      <h1 className="detail__title">{item.title}</h1>
      <div className="detail__facts">
        <div className="detail__meta">
          {item.creator && (
            <span className="label">
              {category.creatorLabel}: {item.creator}
            </span>
          )}
          {item.year && <span className="label">{item.year}</span>}
          {item.detail && (
            <span className="label">
              {category.detailLabel}: {item.detail}
            </span>
          )}
        </div>
        {/*
          On its own line rather than in the row above. Sharing the row meant
          the pill landed wherever the director's name happened to end, which
          read as an afterthought hung off the year — and moved about from one
          item to the next. Below the facts it lands in the same place every
          time, whether or not there is a director.

          Shaped like the chip it was chosen from, but inert: no border to
          press, no hover, no pointer. It is a label wearing a pill, and it
          should not invite a tap that does nothing.
        */}
        {item.tag && category.tagGroup && (
          <div className="detail__tag">
            <span className="label detail__tag-label">
              {tagLabel(category, item.status)}
            </span>
            <span className="tagpill">{item.tag}</span>
          </div>
        )}
      </div>

      {wants && links.primary.href && (
        <section className="buybox">
          <span className="label">{category.buyHeading}</span>
          {links.note && <p className="buybox__note">{links.note}</p>}
          <a
            className="buy"
            href={links.primary.href}
            target="_blank"
            rel="noreferrer"
          >
            <span>
              {links.primary.label}
              {item.price ? ` - ${formatPrice(item.price)}` : ''}
            </span>
            <span aria-hidden="true">&rarr;</span>
          </a>
          {links.secondary && (
            <a
              className="buybox__second label"
              href={links.secondary.href}
              target="_blank"
              rel="noreferrer"
            >
              Or try {links.secondary.label} &rarr;
            </a>
          )}
        </section>
      )}

      {item.notes && <div className="detail__notes">{item.notes}</div>}

      {canEdit && (
        <div className="actions">
          <button className="btn btn--solid" onClick={() => go(`/i/${item.id}/edit`)}>
            Edit
          </button>
          {confirming ? (
            <button
              className="btn btn--danger"
              onClick={() => {
                onRemove(item.id)
                go(`/c/${item.category}`)
              }}
            >
              Really remove?
            </button>
          ) : (
            <button className="btn btn--quiet" onClick={() => setConfirming(true)}>
              Remove
            </button>
          )}
        </div>
      )}
    </article>
  )
}
