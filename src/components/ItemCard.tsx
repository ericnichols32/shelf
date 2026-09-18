import { byId } from '../categories'
import { go } from '../route'
import type { Item } from '../types'
import Cover from './Cover'
import { formatPrice } from '../price'

/** Rotations cycle so a column of cards never repeats the same lean. */
const TILTS = ['-0.9deg', '0.7deg', '-0.45deg', '1deg', '-0.7deg', '0.5deg']

export default function ItemCard({ item, index }: { item: Item; index: number }) {
  const category = byId(item.category)
  if (!category) return null

  const tagged = Boolean(category.tagGroup && item.tag)

  return (
    <button
      className="card"
      style={{ ['--tilt' as string]: TILTS[index % TILTS.length] } as React.CSSProperties}
      onClick={() => go(`/i/${item.id}`)}
    >
      <span className={`card__frame ${item.cutout ? 'card__frame--bare' : ''}`}>
        <Cover item={item} category={category} className="card__art" />
      </span>
      <span className="card__caption">
        <b>{item.title}</b>
        {/*
          On a shelf that tags its things, the tag is the second line: which
          pressing, which edition. It says more at a glance than the director
          does, and it is the thing you are actually scanning for. Everywhere
          else the maker and the year keep that slot.

          Nothing says "wants" here any more — the pill at the bottom already
          decides which list is on screen, so every caption would say it.
        */}
        {tagged ? (
          <>
            {' / '}
            {item.tag}
            {/* A price is worth showing on a wish list whatever else the
                caption carries — a synced game reads title / console / price,
                the way a LEGO set reads title / theme / price. */}
            {item.status === 'wants' && item.price ? (
              <> / {formatPrice(item.price)}</>
            ) : null}
          </>
        ) : (
          <>
            {item.creator && <> / {item.creator}</>}
            {/* On the wish list a price says more than a year does. Owned
                things keep their year — what they cost is no longer news. */}
            {item.status === 'wants' && item.price ? (
              <> / {formatPrice(item.price)}</>
            ) : (
              item.year && <> / {item.year}</>
            )}
          </>
        )}
      </span>
    </button>
  )
}
