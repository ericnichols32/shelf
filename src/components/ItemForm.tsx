import { useEffect, useRef, useState } from 'react'
import { shopName, tagLabel, type Category } from '../categories'
import { canLookUp, lookup, lookupKey, type LookupState } from '../lookup'
import { fromLink, fromSeen, identifyPhoto, seenToFilled, type Filled, type Seen } from '../quickadd'
import { defaultStore, rememberStore } from '../stores'
import { asUrl, looksLikeUrl } from '../web'
import { back, go } from '../route'
import { EMPTY_ITEM, type Item, type NewItem, type Status } from '../types'
import Cover from './Cover'

/** Long enough that a lookup follows a pause in typing, not every keystroke. */
const SETTLE_MS = 700

export default function ItemForm({
  category,
  existing,
  initialStatus = 'owns',
  onSave,
}: {
  category: Category
  existing?: Item
  initialStatus?: Status
  onSave: (values: NewItem) => void
}) {
  const [values, setValues] = useState<NewItem>(
    existing ?? { ...EMPTY_ITEM, category: category.id, status: initialStatus },
  )
  const [state, setState] = useState<LookupState>({ phase: 'idle' })
  /** Once a cover is typed or cleared by hand, lookups stop touching it. */
  const coverIsMine = useRef(Boolean(existing?.cover))
  const lastKey = useRef('')

  const set = (key: keyof NewItem) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  /** What the link or photo turned up, poured into the form. */
  const fill = (filled: Filled) => {
    const found = Object.fromEntries(
      Object.entries(filled).filter(([, v]) => v !== undefined && v !== ''),
    ) as Filled
    if (found.cover) {
      coverIsMine.current = true
      setState({
        phase: 'found',
        source: found.link ? shopName(found.link) : 'the page',
      })
    }
    lastKey.current = lookupKey(category.id, {
      title: found.title ?? '',
      creator: found.creator ?? '',
      detail: found.detail ?? '',
    })
    setValues((v) => ({ ...v, ...found }))
  }

  // A link pasted where the title goes means "fill this in from that page".
  const onTitle = (e: { target: { value: string } }) => {
    const text = e.target.value
    if (!existing && looksLikeUrl(text)) {
      const url = asUrl(text)
      setValues((v) => ({ ...v, title: '', link: url }))
      setLinkToRead({ url })
      return
    }
    set('title')(e)
  }
  // An object, so pasting the same link twice still reads it twice.
  const [linkToRead, setLinkToRead] = useState<{ url: string } | null>(null)

  // Look the cover up once the typing settles. Only ever fills blanks: the
  // title and any field already written stay exactly as they were.
  const key = lookupKey(category.id, values)
  useEffect(() => {
    if (!canLookUp(category.id)) return
    if (coverIsMine.current) return
    if (category.id === 'lego' ? key.length < 4 : values.title.trim().length < 3)
      return
    if (key === lastKey.current) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      lastKey.current = key
      setState({ phase: 'looking' })
      try {
        const { found, source } = await lookup(category.id, values, controller.signal)
        if (controller.signal.aborted) return
        if (!found?.cover) {
          setState({ phase: 'missing', source })
          return
        }
        setValues((v) => ({
          ...v,
          cover: v.cover || found.cover || '',
          year: v.year || found.year || '',
          creator: v.creator || found.creator || '',
          ref: found.ref || v.ref,
        }))
        setState({ phase: 'found', source })
      } catch {
        // Aborted by the next keystroke; the newer lookup will report.
      }
    }, SETTLE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // values is read inside, but the key is what decides a new lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, category.id])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!values.title.trim()) return
    onSave({ ...values, title: values.title.trim(), category: category.id })
  }

  return (
    <form className="form" onSubmit={submit}>
      <span className="label">{category.name}</span>
      <h1 className="form__title">
        {existing ? 'Edit' : `Add to ${category.name}`}
      </h1>

      <div className="choice">
        {(['owns', 'wants'] as Status[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn ${values.status === s ? 'btn--solid' : ''}`}
            onClick={() => setValues((v) => ({ ...v, status: s }))}
          >
            {s === 'owns' ? 'I own it' : 'I want it'}
          </button>
        ))}
      </div>

      {!existing && (
        <QuickFill category={category} onFill={fill} link={linkToRead} />
      )}

      <label className="field">
        <span className="label">Title</span>
        <input
          value={values.title}
          onChange={onTitle}
          placeholder={category.titleHint}
          autoFocus
          required
        />
      </label>

      <label className="field">
        <span className="label">{category.creatorLabel}</span>
        <input
          value={values.creator}
          onChange={set('creator')}
          placeholder={category.creatorHint}
        />
      </label>

      <div className="row">
        <label className="field">
          <span className="label">Year</span>
          <input
            value={values.year}
            onChange={set('year')}
            placeholder="1977"
            inputMode="numeric"
          />
        </label>
        <label className="field">
          <span className="label">{category.detailLabel}</span>
          <input
            value={values.detail}
            onChange={set('detail')}
            placeholder={category.detailHint}
          />
        </label>
      </div>

      {category.tagGroup && (
        <fieldset className="chips">
          <legend className="label">{tagLabel(category, values.status)}</legend>
          {category.tagGroup.options.map((option) => {
            const on = values.tag === option
            return (
              <button
                key={option}
                type="button"
                className={`chip ${on ? 'chip--on' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  setValues((v) => ({ ...v, tag: on ? '' : option }))
                }
              >
                {option}
              </button>
            )
          })}
        </fieldset>
      )}

      <Artwork
        values={values}
        category={category}
        state={state}
        onChange={(cover) => {
          coverIsMine.current = true
          setState({ phase: 'idle' })
          setValues((v) => ({ ...v, cover }))
        }}
        onCutout={(cutout) => setValues((v) => ({ ...v, cutout }))}
        onRetry={() => {
          coverIsMine.current = false
          lastKey.current = ''
          setValues((v) => ({ ...v, cover: '' }))
        }}
      />

      <label className="field">
        <span className="label">Where to buy it</span>
        <input
          value={values.link}
          onChange={set('link')}
          placeholder="https://..."
          inputMode="url"
        />
        <span className="field__hint">
          Blank is fine &mdash; a wanted item falls back to{' '}
          {category.links({ ...values, id: '', addedAt: 0 } as Item).primary.label}.
          Paste any shop&rsquo;s link and the button takes that shop&rsquo;s name.
        </span>
      </label>

      <label className="field">
        <span className="label">Notes</span>
        <textarea value={values.notes} onChange={set('notes')} />
      </label>

      <div className="actions">
        <button className="btn btn--solid" type="submit">
          {existing ? 'Save' : 'Add to shelf'}
        </button>
        <button className="btn btn--quiet" type="button" onClick={back}>
          Cancel
        </button>
      </div>

      {!existing && (
        <p className="form__aside">
          Got a lot of them?{' '}
          <button
            type="button"
            className="linkish"
            onClick={() => go(`/c/${category.id}/import`)}
          >
            Paste a list instead
          </button>
          .
        </p>
      )}
    </form>
  )
}

/**
 * Filling the form in from a photo or a link.
 *
 * Three ways in: take a photo, pick one from the library, or paste a link
 * into the box underneath — no button for that, the box reads it as it lands. After a photo comes the one question it can't answer — which
 * shop you saw it in — asked while the photo is already being read, so the
 * answer is usually waiting by the time you've typed it. (A link pasted
 * straight into Title still works too.)
 */
type Stage = 'choose' | 'shop' | 'working'

function QuickFill({
  category,
  onFill,
  link,
}: {
  category: Category
  onFill: (filled: Filled) => void
  /** A link just pasted into Title, to read. */
  link: { url: string } | null
}) {
  const [stage, setStageState] = useState<Stage>('choose')
  // Kept in step with `stage` for the photo reading, which finishes later and
  // must not talk over a shop search that has already started.
  const stageNow = useRef<Stage>('choose')
  const setStage = (next: Stage) => {
    stageNow.current = next
    setStageState(next)
  }
  const [store, setStore] = useState(() => defaultStore(category))
  const [pasted, setPasted] = useState('')
  const [status, setStatus] = useState<{ text: string; busy: boolean; bad?: boolean } | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const running = useRef<AbortController | null>(null)
  /** The photo being read, started the moment it was chosen. */
  const reading = useRef<Promise<Seen> | null>(null)

  useEffect(() => () => running.current?.abort(), [])
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo])

  const run = async (work: (signal: AbortSignal, step: (t: string) => void) => Promise<string | undefined>) => {
    running.current?.abort()
    const controller = new AbortController()
    running.current = controller
    setStage('working')
    const step = (text: string) => {
      if (!controller.signal.aborted) setStatus({ text, busy: true })
    }
    try {
      const note = await work(controller.signal, step)
      if (controller.signal.aborted) return
      setStatus({
        text: note ?? 'Filled in — check it over, pick a tag, and add it.',
        busy: false,
        bad: Boolean(note),
      })
    } catch (err) {
      if (controller.signal.aborted) return
      setStatus({
        text: (err as Error)?.message || 'Something went wrong.',
        busy: false,
        bad: true,
      })
    }
  }

  const readLink = (url: string) => {
    setPhoto(null)
    run(async (signal, step) => {
      try {
        onFill({ ...(await fromLink(category, url, signal, step)) })
        return undefined
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err
        onFill({ link: url })
        throw new Error('Couldn’t read that page. The link is kept below — type the title in.')
      }
    })
  }

  useEffect(() => {
    if (link) readLink(link.url)
    // Only a new paste starts a new read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link])

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    running.current?.abort()
    setPhoto(URL.createObjectURL(file))
    setStage('shop')
    setStatus({ text: 'Reading the photo…', busy: true })
    const started = identifyPhoto(category, file)
    reading.current = started
    started.then(
      (seen) => {
        if (reading.current !== started || stageNow.current !== 'shop') return
        // What it is goes into the form straight away; the shop adds the rest.
        onFill(seenToFilled(category, seen))
        const who = seen.creator ? ` by ${seen.creator}` : ''
        setStatus({ text: `That’s ${seen.title}${who}.`, busy: false })
      },
      (err) => {
        if (reading.current !== started) return
        setStatus({ text: (err as Error)?.message || 'Couldn’t read that photo.', busy: false, bad: true })
        setStage('working')
      },
    )
  }

  const findIt = (shop: string) => {
    const seenNow = reading.current
    if (!seenNow) return
    if (shop.trim()) rememberStore(category, shop)
    run(async (signal, step) => {
      step('Reading the photo…')
      const seen = await seenNow
      const { filled, note } = await fromSeen(category, seen, shop, signal, step)
      onFill(filled)
      return note
    })
  }

  const startOver = () => {
    running.current?.abort()
    reading.current = null
    setPhoto(null)
    setStatus(null)
    setPasted('')
    setStage('choose')
  }

  return (
    <div className="quick">
      <span className="label">Fill it in for me</span>

      {stage === 'choose' && (
        <div className="quick__options">
          <button type="button" className="quick__option" onClick={() => camera.current?.click()}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            Take picture
          </button>
          <button type="button" className="quick__option" onClick={() => library.current?.click()}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="14" />
              <path d="M4 16l5-5 4 4 2.5-2.5L20 17" />
              <circle cx="15.5" cy="9.5" r="1.3" />
            </svg>
            Upload picture
          </button>
        </div>
      )}

      {stage === 'choose' && (
        <input
          className="quick__link"
          value={pasted}
          onChange={(e) => {
            setPasted(e.target.value)
            if (looksLikeUrl(e.target.value)) readLink(asUrl(e.target.value))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (looksLikeUrl(pasted)) readLink(asUrl(pasted))
            }
          }}
          placeholder="Paste a link"
          aria-label="Paste a link"
          inputMode="url"
          autoComplete="off"
        />
      )}

      {stage === 'shop' && (
        <div className="quick__step">
          <label className="quick__field">
            <span className="label">Which shop is it from?</span>
            <input
              value={store}
              onChange={(e) => setStore(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  findIt(store)
                }
              }}
              placeholder="Shop name"
              autoComplete="off"
            />
          </label>
          <div className="quick__actions">
            <button type="button" className="btn btn--solid" onClick={() => findIt(store)} disabled={!store.trim()}>
              Find it there
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => findIt('')}>
              Skip
            </button>
          </div>
        </div>
      )}

      {(photo || status) && stage !== 'choose' ? (
        <div className="quick__result">
          {photo && <img className="quick__photo" src={photo} alt="" />}
          {status && (
            <p
              className={`quick__status ${status.busy ? 'quick__status--busy' : ''} ${status.bad ? 'quick__status--bad' : ''}`}
              role="status"
            >
              {status.text}
            </p>
          )}
        </div>
      ) : null}

      {stage === 'working' && !status?.busy && (
        <button type="button" className="linkish quick__back" onClick={startOver}>
          Start again
        </button>
      )}

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
      <input ref={library} type="file" accept="image/*" hidden onChange={onPhoto} />
    </div>
  )
}

/** The cover: found for you where that is possible, typed in where it is not. */
function Artwork({
  values,
  category,
  state,
  onChange,
  onCutout,
  onRetry,
}: {
  values: NewItem
  category: Category
  state: LookupState
  onChange: (cover: string) => void
  onCutout: (on: boolean) => void
  onRetry: () => void
}) {
  const auto = canLookUp(category.id)

  return (
    <div className="field artwork">
      <span className="label">Cover</span>

      {values.cover && (
        <>
          <div className="artwork__preview">
            <Cover item={values} category={category} className="card__art" />
          </div>
          <label className="switchrow">
            <input
              type="checkbox"
              checked={values.cutout}
              onChange={(e) => onCutout(e.target.checked)}
            />
            <span>
              Cut the white background out
              <span className="switchrow__note">
                For a box shot on plain white. Some picture hosts won&rsquo;t
                allow it &mdash; the preview above shows what you&rsquo;ll get.
              </span>
            </span>
          </label>
        </>
      )}

      <p className="artwork__status">
        {state.phase === 'looking' && <>Looking for the cover&hellip;</>}
        {state.phase === 'found' && (
          <>
            Found on {state.source}.{' '}
            <button type="button" className="linkish" onClick={onRetry}>
              Not this one
            </button>
          </>
        )}
        {state.phase === 'missing' && (
          <>Nothing on {state.source} matched &mdash; paste a URL below.</>
        )}
        {state.phase === 'idle' && idleMessage(category, auto)}
      </p>

      <input
        value={values.cover}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        inputMode="url"
      />
      <span className="field__hint">
        Leave it blank and the card sets the title in large type instead.
      </span>
    </div>
  )
}

/**
 * What the cover box says before anything has been typed.
 *
 * Only Switch games have no catalogue to search at all. A film with no TMDB
 * token is a different situation — the setup is missing, not the source — so it
 * gets the ordinary instruction rather than an explanation about Nintendo.
 */
function idleMessage(category: Category, auto: boolean): string {
  if (category.id === 'switch') {
    return 'Nintendo publishes no open catalogue, so these are pasted by hand.'
  }
  if (!auto) return 'Paste a cover URL below.'
  if (category.id === 'lego') {
    return 'Enter the set number and the picture appears by itself.'
  }
  return 'Type the title and the cover appears by itself.'
}
