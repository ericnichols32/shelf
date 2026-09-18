import { useEffect, useState } from 'react'
import {
  gamesInLink,
  readNintendoLink,
  saveNintendoLink,
} from '../backend/settings'

/**
 * Where a fresh Nintendo wish list link goes.
 *
 * Nintendo's share link is a snapshot, not a live list, so this is how the
 * shelf hears about a changed wish list: share it again on Nintendo's site,
 * paste the new link here. The sync on the Mac picks it up within the hour.
 */
export default function NintendoLink() {
  const [saved, setSaved] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'bad'>('idle')

  useEffect(() => {
    readNintendoLink().then(setSaved, () => setSaved(''))
  }, [])

  const count = gamesInLink(draft)

  const save = async () => {
    if (!count) {
      setState('bad')
      return
    }
    setState('saving')
    await saveNintendoLink(draft.trim())
    setSaved(draft.trim())
    setDraft('')
    setState('done')
  }

  return (
    <section className="nintendo">
      <span className="label">Nintendo wish list</span>
      <p className="nintendo__lead">
        {saved === null
          ? 'Checking…'
          : saved
            ? `Syncing ${gamesInLink(saved)} games from your last shared link. Prices update on their own.`
            : 'No link saved yet.'}
      </p>
      <p className="nintendo__how">
        Nintendo&rsquo;s share link is a snapshot, so when your wish list changes:
        on Nintendo&rsquo;s site open your wish list, <b>Share</b>, copy the link,
        and paste it here.
      </p>

      <div className="nintendo__row">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setState('idle')
          }}
          placeholder="https://www.nintendo.com/us/wish-list/share/#skus=…"
          inputMode="url"
        />
        <button
          className="btn btn--solid"
          onClick={save}
          disabled={!draft.trim() || state === 'saving'}
        >
          Save
        </button>
      </div>

      <p className="nintendo__note">
        {state === 'bad' &&
          'That doesn’t look like a Nintendo wish list share link — it should contain #skus=.'}
        {state === 'done' &&
          'Saved. The shelf catches up within the hour — games added, dropped ones removed.'}
        {state === 'idle' && draft && count > 0 && `${count} games in this link.`}
      </p>
    </section>
  )
}
