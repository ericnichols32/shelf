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
  const shown = tag ? onThisSide.filter((i) => i.tag === tag) : onThisSide

  return (
    <>
      <header className="cathead">
        <h1 className="cathead__name">{category.name}</h1>
        <p className="cathead__sub">
          {status === 'wants' ? 'Wish List' : 'Eric\u2019s Collection'}
        </p>
        <span className="label">
          {counts[status]}{' '}
          {counts[status] === 1
            ? category.noun.replace(/s$/, '')
            : category.noun}{' '}
          {status === 'wants' ? 'wanted' : 'logged'}
        </span>
      </header>
      <hr className="rule" />

      {/* Filters on the left, Arrange at the right end — one line under the
          rule, so the shelf's controls read as a single row. */}
      <div className="shelfbar">
        {category.tagGroup && onThisSide.length > 0 && !arranging ? (
          <nav
            className="filters"
            aria-label={`Filter by ${category.tagGroup.label}`}
          >
            {[null, ...category.tagGroup.options].map((option) => {
              // A tag nothing on this side carries would only ever show an
              // empty shelf, so it is left out rather than offered.
              const count = option
                ? onThisSide.filter((i) => i.tag === option).length
                : onThisSide.length
              if (!count) return null
              return (
                <button
                  key={option ?? 'all'}
                  className="filter"
                  aria-pressed={tag === option}
                  onClick={() => setTag(option)}
                >
                  {option ? tagTabLabel(category, option) : 'All'}
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
        <div className="pill" role="group" aria-label="Owned or wanted">
          {(['wants', 'owns'] as Status[]).map((s) => (
            <button
              key={s}
              className="pill__seg"
              aria-pressed={status === s}
              onClick={() => onStatus(s)}
            >
              {s}
              <span className="pill__count">{counts[s]}</span>
            </button>
          ))}
        </div>
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
