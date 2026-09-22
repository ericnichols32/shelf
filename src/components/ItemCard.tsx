import { byId } from '../categories'
import type { Item } from '../types'
import Cover from './Cover'
import Peek from './Peek'
import { isUpcoming, shortWhen } from '../released'
import { formatPrice } from '../price'

/** Rotations cycle so a column of cards never repeats the same lean. */
const TILTS = ['-0.9deg', '0.7deg', '-0.45deg', '1deg', '-0.7deg', '0.5deg']

/**
 * One thing in the grid. Tapping it doesn't leave the shelf: the card dims
 * and its details and shop button come up over it (see Peek).
 */
export default function ItemCard({
  item,
  index,
  open,
  onToggle,
  onRemove,
}: {
  item: Item
  index: number
  open: boolean
  onToggle: () => void
  onRemove?: (id: string) => void
}) {
  const category = byId(item.category)
  if (!category) return null

  const tagged = Boolean(category.tagGroup && item.tag)

  return (
    <div
      className={`card ${open ? 'card--open' : ''}`}
      style={{ ['--tilt' as string]: TILTS[index % TILTS.length] } as React.CSSProperties}
    >
      <button className="card__hit" onClick={onToggle} aria-expanded={open}>
        <span
          className={`card__frame ${item.cutout ? 'card__frame--bare' : category.frameless ? 'card__frame--flat' : ''}`}
        >
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
              {item.status === 'owns' && item.version && <> / {item.version}</>}
              {/* A price is worth showing on a wish list whatever else the
                  caption carries — a synced game reads title / console / price,
                  the way a LEGO set reads title / theme / price. */}
              {item.status === 'wants' && item.price ? (
                <> / {formatPrice(item.price)}</>
              ) : null}
              {/* Not out yet: when it arrives, after the price, in red. */}
              {isUpcoming(item.released) && (
                <span className="card__soon"> / {shortWhen(item.released!)}</span>
              )}
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
              {item.status === 'owns' && item.version && <> / {item.version}</>}
              {isUpcoming(item.released) && (
                <span className="card__soon"> / {shortWhen(item.released!)}</span>
              )}
            </>
          )}
        </span>
      </button>
      {open && (
        // Tapping the dimmed card anywhere but a button or link puts it away.
        <div
          className="peekover card__peek"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('a, button')) onToggle()
          }}
        >
          <Peek item={item} category={category} onClose={onToggle} onRemove={onRemove} compact />
        </div>
      )}
    </div>
  )
}
