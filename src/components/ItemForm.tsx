import { useEffect, useRef, useState } from 'react'
import { shopName, tagLabel, type Category } from '../categories'
import { canLookUp, lookup, lookupKey, type LookupState } from '../lookup'
import { fromLink, fromPhoto, type Filled } from '../quickadd'
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
          placeholder={existing ? category.titleHint : `${category.titleHint}, or paste a link`}
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
 * Filling the form in from a link or a photo.
 *
 * The link half has no controls of its own — it is the Title box, which
 * notices a pasted address. This shows its progress, and holds the photo half:
 * the shop you're standing in, and a button that opens the camera.
 */
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
  const [store, setStore] = useState(() => defaultStore(category))
  const [status, setStatus] = useState<{ text: string; busy: boolean; bad?: boolean } | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const running = useRef<AbortController | null>(null)
  // Read at the moment the shop is searched, so it can be typed while the
  // photo is still being read.
  const storeNow = useRef(store)

  useEffect(() => () => running.current?.abort(), [])
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo])

  const run = async (work: (signal: AbortSignal, step: (t: string) => void) => Promise<string | undefined>) => {
    running.current?.abort()
    const controller = new AbortController()
    running.current = controller
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

  useEffect(() => {
    if (!link) return
    setPhoto(null)
    run(async (signal, step) => {
      try {
        onFill(await fromLink(category, link.url, signal, step))
        return undefined
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err
        throw new Error('Couldn’t read that page. The link is kept below — type the title in.')
      }
    })
    // Only a new paste starts a new read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link])

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhoto(URL.createObjectURL(file))
    if (store.trim()) rememberStore(category, store)
    run(async (signal, step) => {
      const { filled, note } = await fromPhoto(category, file, () => storeNow.current, signal, step)
      onFill(filled)
      return note
    })
  }

  return (
    <div className="quick">
      <span className="label">Fill it in for me</span>
      <p className="quick__how">
        Paste a link into Title below, or take a photo of it in the shop.
      </p>
      <div className="quick__row">
        <label className="quick__store">
          <span className="label">Shop</span>
          <input
            value={store}
            onChange={(e) => {
              setStore(e.target.value)
              storeNow.current = e.target.value
            }}
            placeholder="Where you are"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="btn btn--solid quick__camera"
          onClick={() => camera.current?.click()}
        >
          Take a photo
        </button>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onPhoto}
        />
      </div>
      {(photo || status) && (
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
      )}
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
