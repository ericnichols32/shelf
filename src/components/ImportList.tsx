import { useState } from 'react'
import type { Category } from '../categories'
import { canLookUp, lookup } from '../lookup'
import { PREPARED } from '../prepared'
import { go } from '../route'
import { EMPTY_ITEM, type NewItem, type Status } from '../types'

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

/** Titles people paste come with list markers and an artist after a dash. */
function parse(text: string): Row[] {
  return text
    .split('\n')
    .map(stripMarkers)
    .filter(Boolean)
    .map((line) => {
      const split = line.split(/\s+(?:[-–—]|by)\s+/i)
      return {
        title: (split[0] ?? line).trim(),
        creator: split.length > 1 ? split.slice(1).join(' ').trim() : '',
        state: 'waiting' as RowState,
      }
    })
}

export default function ImportList({
  category,
  initialStatus,
  onAdd,
}: {
  category: Category
  initialStatus: Status
  onAdd: (item: NewItem) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>(initialStatus)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [running, setRunning] = useState(false)
  const [added, setAdded] = useState(0)

  const prepared = PREPARED[category.id] ?? []

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
    const parsed = parse(text)
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

          <label className="field">
            <span className="label">The list</span>
            <textarea
              className="import__box"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <span className="field__hint">
              {parse(text).length || 'No'}{' '}
              {parse(text).length === 1 ? 'title' : 'titles'} so far.
            </span>
          </label>

          <div className="actions">
            <button
              className="btn btn--solid"
              onClick={run}
              disabled={!parse(text).length}
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
