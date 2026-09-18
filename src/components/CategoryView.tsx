import { tagTabLabel, type Category } from '../categories'
import { useEffect, useState } from 'react'
import { go } from '../route'
import { useCanEdit } from '../edit'
import type { Item, Status } from '../types'
import ItemCard from './ItemCard'
import ArrangeList from './ArrangeList'

export default function CategoryView({
  category,
  items,
  status,
  onStatus,
  onSeed,
  onReorder,
  seeding,
}: {
  category: Category
  items: Item[]
  status: Status
  onStatus: (status: Status) => void
  onSeed: () => void
  onReorder: (id: string, sort: number) => void
  seeding: boolean
}) {
  /** Which tag the feed is narrowed to, or null for all of them. */
  const canEdit = useCanEdit()
  const [tag, setTag] = useState<string | null>(null)
  /** Arranging the list by hand. Only ever offered to whoever may edit. */
  const [arranging, setArranging] = useState(false)
  useEffect(() => setArranging(false), [category.id, status])
  // A tag from one shelf means nothing on the next.
  useEffect(() => setTag(null), [category.id])

  const mine = items.filter((i) => i.category === category.id)
  const counts = {
    owns: mine.filter((i) => i.status === 'owns').length,
    wants: mine.filter((i) => i.status === 'wants').length,
  }
  const onThisSide = mine.filter((i) => i.status === status)
  /**
   * What the filters work from on this shelf.
   *
   * Most shelves filter by their tag, whose options are a fixed list in the
   * shelf's settings. LEGO filters by theme, and its themes are open-ended —
   * they come from LEGO with each set — so the options are simply the themes
   * on this side, commonest first. A new theme gets its own tab on arrival.
   */
  const keyOf = (i: Item) => (category.filterByCreator ? i.creator : i.tag)
  const filterOptions: string[] = category.filterByCreator
    ? [...new Set(onThisSide.map(keyOf).filter(Boolean))].sort(
        (a, b) =>
          onThisSide.filter((i) => keyOf(i) === b).length -
            onThisSide.filter((i) => keyOf(i) === a).length ||
          a.localeCompare(b),
      )
    : (category.tagGroup?.options ?? [])
  const filterLabel = category.filterByCreator
    ? category.creatorLabel
    : category.tagGroup?.label

  const shown = tag ? onThisSide.filter((i) => keyOf(i) === tag) : onThisSide

  return (
    <>
      <header className="cathead">
        <h1 className="cathead__name">{category.name}</h1>
      </header>

      {/* Which side you are looking at, said once and chosen in the same
          place. This used to float at the bottom of the screen and the shelf
          named it again underneath the title; now it does both jobs at the
          top, where you look first. */}
      <nav className="sides" aria-label="Wish list or collection">
        {(['wants', 'owns'] as Status[]).map((s) => (
          <button
            key={s}
            className="sides__tab"
            aria-pressed={status === s}
            onClick={() => onStatus(s)}
          >
            {s === 'wants' ? 'Wish List' : 'Collection'}
          </button>
        ))}
      </nav>

      <p className="cathead__count label">
        {counts[status]}{' '}
        {counts[status] === 1
          ? category.noun.replace(/s$/, '')
          : category.noun}{' '}
        {status === 'wants' ? 'wanted' : 'logged'}
      </p>
      <hr className="rule" />

      {/* Filters on the left, Arrange at the right end — one line under the
          rule, so the shelf's controls read as a single row. */}
      <div className="shelfbar">
        {/* Only worth showing when something on this side actually carries a
            tag — a lone "All" filters nothing. */}
        {filterOptions.length > 0 &&
        !arranging &&
        onThisSide.some((i) => keyOf(i)) ? (
          <nav className="filters" aria-label={`Filter by ${filterLabel}`}>
            {[null, ...filterOptions].map((option) => {
              // A tag nothing on this side carries would only ever show an
              // empty shelf, so it is left out rather than offered.
              const count = option
                ? onThisSide.filter((i) => keyOf(i) === option).length
                : onThisSide.length
              if (!count) return null
              return (
                <button
                  key={option ?? 'all'}
                  className="filter"
                  aria-pressed={tag === option}
                  onClick={() => setTag(option)}
                >
                  {option
                    ? category.filterByCreator
                      ? option
                      : tagTabLabel(category, option)
                    : 'All'}
                  <span className="filter__count">{count}</span>
                </button>
              )
            })}
          </nav>
        ) : (
          <span />
        )}

        {canEdit && onThisSide.length > 1 && (
          <button
            className="btn btn--quiet arrange"
            aria-pressed={arranging}
            onClick={() => {
              // Arranging always works on the whole side. Reordering inside a
              // filter means swapping with neighbours you cannot see, which
              // looks like nothing happening.
              setTag(null)
              setArranging((a) => !a)
            }}
          >
            {arranging ? 'Done' : 'Arrange'}
          </button>
        )}
      </div>

      {arranging ? (
        <ArrangeList items={onThisSide} onReorder={onReorder} />
      ) : shown.length > 0 ? (
        <div className="feed">
          {shown.map((item, i) => (
            <ItemCard key={item.id} item={item} index={i} />
          ))}
        </div>
      ) : (
        <Empty
          category={category}
          status={status}
          shelfEmpty={mine.length === 0}
          onSeed={onSeed}
          seeding={seeding}
        />
      )}

      <div className="dock">
        {canEdit && (
          <button
            className="addbtn"
            aria-label={`Add to ${category.name}`}
            onClick={() => go(`/c/${category.id}/new`)}
          >
            +
          </button>
        )}
      </div>
    </>
  )
}

function Empty({
  category,
  status,
  shelfEmpty,
  onSeed,
  seeding,
}: {
  category: Category
  status: Status
  shelfEmpty: boolean
  onSeed: () => void
  seeding: boolean
}) {
  const canEdit = useCanEdit()
  const wants = status === 'wants'
  return (
    <div className="empty">
      <span className="label">{status}</span>
      <h2 className="empty__head">
        {wants
          ? `Nothing on the ${category.name} wish list.`
          : `No ${category.noun} logged yet.`}
      </h2>
      <p>
        {wants
          ? 'Add something you are hunting for and it shows up here with a link to go buy it.'
          : `Tap the plus to add your first of the ${category.noun}.`}
      </p>
      {canEdit && (
        <div className="empty__actions">
          <button
            className="btn"
            onClick={() => go(`/c/${category.id}/import`)}
          >
            Paste a list
          </button>
          {shelfEmpty && (
            <button
              className="btn btn--quiet"
              onClick={onSeed}
              disabled={seeding}
            >
              {seeding ? 'Finding covers\u2026' : 'Load a few samples'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
