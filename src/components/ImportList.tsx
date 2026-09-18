import { useState } from 'react'
import type { Category } from '../categories'
import { canLookUp, lookup } from '../lookup'
import { PREPARED } from '../prepared'
import { go } from '../route'
import { EMPTY_ITEM, type Item, type NewItem, type Status } from '../types'

/**
 * Adding a shelf's worth of things at once, from a list pasted in.
 *
 * One title a line. Everything the lookup can find — cover, year, the artist or
 * author, a book's ISBN — is filled in as it goes; anything it can't find is
 * simply left blank, and the row says so rather than failing the import.
 */

type RowState = 'waiting' | 'looking' | 'done' | 'bare'

interface Row {
  title: string
  creator: string
  state: RowState
  cover?: string
}

/**
 * Strip whatever a list app put at the front of the line.
 *
 * Bullets, numbers and checkboxes turn up in any combination and any order —
 * `- [ ] Heat`, `1. [ ] Heat` — so this keeps taking markers off until the line
 * stops changing, rather than trying to match every arrangement at once.
 */
function stripMarkers(line: string): string {
  let out = line.trim()
  for (;;) {
    const before = out
    out = out
      .replace(/^[-*•–—]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^\[\s*[xX✓✔]?\s*\]\s*/, '')
      .trim()
    if (out === before) return out
  }
}

type Order = 'creator-first' | 'title-first'

/** Titles people paste have a name either side of a dash — but which is which? */
function parse(text: string, order: Order): Row[] {
  return text
    .split('\n')
    .map(stripMarkers)
    .filter(Boolean)
    .map((line) => {
      const split = line.split(/\s+(?:[-–—]|by)\s+/i)
      if (split.length < 2) {
        return { title: line.trim(), creator: '', state: 'waiting' as RowState }
      }
      const parts = split.map((part) => part.trim())
      const first = parts[0]
      const second = parts.slice(1).join(' ')
      // "by" names the maker outright, whichever way the shelf usually reads.
      const saysBy = /\s+by\s+/i.test(line)
      return order === 'creator-first' && !saysBy
        ? { title: second, creator: first, state: 'waiting' as RowState }
        : { title: first, creator: second, state: 'waiting' as RowState }
    })
}

export default function ImportList({
  category,
  initialStatus,
  items,
  onAdd,
  onUpdate,
}: {
  category: Category
  initialStatus: Status
  items: Item[]
  onAdd: (item: NewItem) => Promise<void>
  onUpdate: (id: string, patch: Partial<Item>) => void
}) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>(initialStatus)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [running, setRunning] = useState(false)
  const [added, setAdded] = useState(0)

  /** Which half of "A - B" is the title. Starts at the shelf's convention. */
  const [order, setOrder] = useState<Order>(
    category.listOrder ?? 'title-first',
  )
  const rowsFromText = parse(text, order)

  const prepared = PREPARED[category.id] ?? []

  /**
   * Undo a list pasted the wrong way round.
   *
   * Getting the halves of "A - B" swapped files every record under its
   * artist's name, and putting that right one item at a time is miserable.
   * Only offered for things that actually have both halves to trade.
   */
  const [swapped, setSwapped] = useState(0)
  const swappable = items.filter(
    (i) => i.category === category.id && i.status === status && i.creator,
  )
  const swapAll = () => {
    swappable.forEach((i) => onUpdate(i.id, { title: i.creator, creator: i.title }))
    setSwapped(swappable.length)
  }

  /**
   * Add a list that was put together in advance, covers and all.
   *
   * Nothing is looked up: these already carry their artwork, their year and,
   * where a shop was checked to stock it, the catalogue number the buy link
   * needs. So it is only as slow as the writing.
   */
  const runPrepared = async () => {
    setRows(
      prepared.map((it) => ({
        title: it.title,
        creator: it.creator,
        state: 'waiting' as RowState,
      })),
    )
    setRunning(true)
    for (let i = 0; i < prepared.length; i++) {
      await onAdd(prepared[i])
      setAdded(i + 1)
      setRows((rs) =>
        rs!.map((r, n) =>
          n === i ? { ...r, state: prepared[i].cover ? 'done' : 'bare' } : r,
        ),
      )
    }
    setRunning(false)
  }

  const run = async () => {
    const parsed = rowsFromText
    if (!parsed.length) return
    setRows(parsed)
    setRunning(true)

    let count = 0
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i]
      setRows((rs) =>
        rs!.map((r, n) => (n === i ? { ...r, state: 'looking' } : r)),
      )

      const values: NewItem = {
        ...EMPTY_ITEM,
        category: category.id,
        status,
        title: row.title,
        creator: row.creator,
        // LEGO is keyed on the set number, and a pasted list of sets is far
        // more likely to be numbers than names.
        detail: category.id === 'lego' ? row.title.replace(/[^0-9]/g, '') : '',
      }

      if (canLookUp(category.id)) {
        try {
          const { found } = await lookup(
            category.id,
            values,
            new AbortController().signal,
          )
          if (found) {
            values.cover = found.cover ?? ''
            values.year = found.year ?? ''
            values.creator = values.creator || found.creator || ''
            values.ref = found.ref ?? ''
          }
        } catch {
          // Leave it bare; the card sets the title instead.
        }
      }

      await onAdd(values)
      count += 1
      setAdded(count)
      setRows((rs) =>
        rs!.map((r, n) =>
          n === i
            ? {
                ...r,
                creator: values.creator,
                cover: values.cover,
                state: values.cover ? 'done' : 'bare',
              }
            : r,
        ),
      )
      // These free catalogues rate-limit a burst, and a pasted list is a burst.
      await new Promise((r) => setTimeout(r, 350))
    }

    setRunning(false)
  }

  const finished = rows !== null && !running

  return (
    <div className="form">
      <span className="label">{category.name}</span>
      <h1 className="form__title">Paste a list</h1>

      {rows === null ? (
        <>
          <p className="import__lead">
            One title a line. Put the {category.creatorLabel.toLowerCase()} after
            a dash if you know it &mdash; <em>Aja &ndash; Steely Dan</em> &mdash;
            and everything else that can be found will be filled in for you.
            {category.id === 'lego' && ' For sets, paste the numbers.'}
          </p>

          <div className="choice">
            {(['owns', 'wants'] as Status[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`btn ${status === s ? 'btn--solid' : ''}`}
                onClick={() => setStatus(s)}
              >
                {s === 'owns' ? 'I own these' : 'I want these'}
              </button>
            ))}
          </div>

          <div className="choice">
            {(
              [
                ['creator-first', `${category.creatorLabel} first`],
                ['title-first', 'Title first'],
              ] as Array<[Order, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`btn ${order === value ? 'btn--solid' : ''}`}
                onClick={() => setOrder(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="field">
            <span className="label">The list</span>
            <textarea
              className="import__box"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <span className="field__hint">
              {rowsFromText.length || 'No'}{' '}
              {rowsFromText.length === 1 ? 'title' : 'titles'} so far.
            </span>
            {/* Shows what the first line was made of, before anything is
                written. Getting the halves the wrong way round files a record
                under its artist's name, and that is tedious to undo. */}
            {rowsFromText[0] && (
              <span className="field__hint import__check">
                First one reads as &mdash; title:{' '}
                <b>{rowsFromText[0].title || '(blank)'}</b>
                {'  \u00b7  '}
                {category.creatorLabel.toLowerCase()}:{' '}
                <b>{rowsFromText[0].creator || '(blank)'}</b>
              </span>
            )}
          </label>

          <div className="actions">
            <button
              className="btn btn--solid"
              onClick={run}
              disabled={!rowsFromText.length}
            >
              Add them
            </button>
            <button
              className="btn btn--quiet"
              onClick={() => go(`/c/${category.id}`)}
            >
              Cancel
            </button>
          </div>

          {swappable.length > 0 && (
            <p className="form__aside">
              {swapped > 0 ? (
                <>Swapped {swapped}. Check the shelf &mdash; run it again to put them back.</>
              ) : (
                <>
                  Pasted a list the wrong way round?{' '}
                  <button type="button" className="linkish" onClick={swapAll}>
                    Swap title and {category.creatorLabel.toLowerCase()} on all{' '}
                    {swappable.length}
                  </button>{' '}
                  on the {status} side. Running it twice puts them back.
                </>
              )}
            </p>
          )}

          {prepared.length > 0 && (
            <p className="form__aside">
              There is a prepared {category.name} list of {prepared.length}{' '}
              ready to go, with covers already found.{' '}
              <button type="button" className="linkish" onClick={runPrepared}>
                Add those instead
              </button>
              .
            </p>
          )}
        </>
      ) : (
        <>
          <p className="import__lead">
            {running
              ? `Adding ${Math.min(added + 1, rows.length)} of ${rows.length}…`
              : `Added ${added} to ${category.name}.`}
          </p>

          <ol className="import__rows">
            {rows.map((row, i) => (
              <li key={i} className={`import__row import__row--${row.state}`}>
                <span className="import__title">{row.title}</span>
                <span className="import__note label">
                  {row.state === 'waiting' && 'waiting'}
                  {row.state === 'looking' && 'looking…'}
                  {row.state === 'done' && 'cover found'}
                  {row.state === 'bare' && 'no cover'}
                </span>
              </li>
            ))}
          </ol>

          {finished && (
            <div className="actions">
              <button
                className="btn btn--solid"
                onClick={() => go(`/c/${category.id}`)}
              >
                See the shelf
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
