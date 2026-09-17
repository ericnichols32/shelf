import { useCallback, useEffect, useMemo, useState } from 'react'
import { getStore } from './backend'
import { cloudConfigured, ownerConfigured } from './backend/config'
import { signIn, signOut, watchViewer } from './backend/session'
import { CanEdit } from './edit'
import { SIGNED_OUT, type Viewer } from './viewer'
import { byId, CATEGORIES } from './categories'
import CategoryView from './components/CategoryView'
import ChooseShelf from './components/ChooseShelf'
import Home from './components/Home'
import ImportList from './components/ImportList'
import ItemDetail from './components/ItemDetail'
import ItemForm from './components/ItemForm'
import TopBar from './components/TopBar'
import { go, isShareMode, shareUrl, useRoute } from './route'
import { canLookUp, lookup } from './lookup'
import { SAMPLES } from './samples'
import type { Item, NewItem, Status } from './types'

type Theme = 'light' | 'dark'

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem('shelf.theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage blocked; fall through to the system preference.
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const route = useRoute()
  const store = useMemo(() => getStore(), [])
  const [viewer, setViewer] = useState<Viewer>(SIGNED_OUT)
  const [items, setItems] = useState<Item[]>([])
  const [theme, setTheme] = useState<Theme>(readTheme)
  /**
   * Which side of the pill is showing. It lives up here so that adding
   * something from the wish list starts the form on "I want it".
   */
  const [side, setSide] = useState<Status>('wants')
  const [copied, setCopied] = useState(false)

  useEffect(() => store.subscribe(setItems), [store])
  useEffect(() => watchViewer(setViewer), [])

  /**
   * On a device with no cloud configured the collection is this browser's own,
   * so editing is simply allowed. On the deployed copy it belongs to one
   * account. `?share` lets that account preview what everyone else sees.
   */
  const canEdit = (!cloudConfigured || viewer.isOwner) && !isShareMode

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('shelf.theme', theme)
    } catch {
      // Not worth telling anyone about; the choice just will not persist.
    }
  }, [theme])

  const add = useCallback(
    (values: NewItem) => {
      void store.add(values)
      setSide(values.status)
      go(`/c/${values.category}`)
    },
    [store],
  )

  const update = useCallback(
    (id: string, patch: Partial<Item>) => void store.update(id, patch),
    [store],
  )

  const remove = useCallback((id: string) => void store.remove(id), [store])

  // Seeding runs each sample through the same lookup the form uses, one at a
  // time so the free APIs aren't hammered. They arrive with real artwork,
  // which makes them a fair demonstration rather than a rigged one.
  const [seeding, setSeeding] = useState(false)
  const seed = useCallback(async () => {
    setSeeding(true)
    for (const sample of SAMPLES) {
      let values = sample
      if (canLookUp(sample.category)) {
        try {
          const { found } = await lookup(
            sample.category,
            sample,
            new AbortController().signal,
          )
          if (found) {
            values = {
              ...sample,
              cover: found.cover ?? '',
              year: sample.year || found.year || '',
              creator: sample.creator || found.creator || '',
              ref: found.ref ?? '',
            }
          }
        } catch {
          // No art for this one; the typographic card covers it.
        }
      }
      await store.add(values)
      // These free catalogues rate-limit a burst, and eleven lookups in a row
      // is a burst. Nobody notices the pause; a wall of 429s would show.
      await new Promise((r) => setTimeout(r, 350))
    }
    setSeeding(false)
  }, [store])

  const bar = (
    back?: { label: string; to: string },
    shelfMenu?: { current: string },
  ) => (
    <TopBar
      back={back}
      shelfMenu={shelfMenu}
      theme={theme}
      onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    />
  )

  if (route.name === 'home') {
    return (
      <CanEdit.Provider value={canEdit}>
      <div className="app">
        {bar()}
        <Home items={items} />
        {canEdit && (
          <div className="dock">
            <button
              className="addbtn"
              aria-label="Add something"
              onClick={() => go('/new')}
            >
              +
            </button>
          </div>
        )}
        <div className="home__foot">
          {cloudConfigured && <Account viewer={viewer} />}
          {store.mode === 'local' && !isShareMode && (
            <p className="notice">
              <strong>Saved on this device only.</strong> Nothing is syncing
              yet, so this shelf lives in one browser. The README has the
              ten-minute setup that turns on the cloud copy and the share link.
            </p>
          )}
          {isShareMode ? (
            <span className="label">Eric&rsquo;s list &middot; read only</span>
          ) : (
            <button
              className="btn btn--quiet"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl())
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  window.prompt('Copy this link:', shareUrl())
                }
              }}
            >
              {copied ? 'Link copied' : 'Copy a read-only link'}
            </button>
          )}
        </div>
      </div>
      </CanEdit.Provider>
    )
  }

  if (route.name === 'choose') {
    return (
      <CanEdit.Provider value={canEdit}>
      <div className="app">
        {bar({ label: 'Home', to: '/' })}
        <ChooseShelf />
      </div>
      </CanEdit.Provider>
    )
  }

  if (
    route.name === 'category' ||
    route.name === 'new' ||
    route.name === 'import'
  ) {
    const category = byId(route.category) ?? CATEGORIES[0]
    return (
      <CanEdit.Provider value={canEdit}>
      <div className="app">
        {route.name === 'category'
          ? bar(undefined, { current: category.id })
          : bar({ label: category.name, to: `/c/${category.id}` })}
        {route.name === 'new' && (
          <ItemForm category={category} initialStatus={side} onSave={add} />
        )}
        {route.name === 'import' && (
          <ImportList
            category={category}
            initialStatus={side}
            onAdd={async (values) => {
              setSide(values.status)
              await store.add(values)
            }}
          />
        )}
        {route.name === 'category' && (
          <CategoryView
            category={category}
            items={items}
            status={side}
            onStatus={setSide}
            onSeed={seed}
            seeding={seeding}
          />
        )}
      </div>
      </CanEdit.Provider>
    )
  }

  const item = items.find((i) => i.id === route.id)
  if (!item) {
    return (
      <CanEdit.Provider value={canEdit}>
      <div className="app">
        {bar({ label: 'Home', to: '/' })}
        <div className="empty">
          <h2 className="empty__head">Not on the shelf.</h2>
          <p>That item has been removed, or the link is wrong.</p>
        </div>
      </div>
      </CanEdit.Provider>
    )
  }

  const category = byId(item.category) ?? CATEGORIES[0]
  return (
    <CanEdit.Provider value={canEdit}>
      <div className="app">
      {bar({ label: category.name, to: `/c/${item.category}` })}
      {route.name === 'edit' ? (
        <ItemForm
          category={category}
          existing={item}
          onSave={(values) => {
            update(item.id, values)
            go(`/i/${item.id}`)
          }}
        />
      ) : (
        <ItemDetail item={item} onRemove={remove} />
      )}
    </div>
    </CanEdit.Provider>
  )
}

/**
 * Signing in, and signing out again.
 *
 * Only shown once a Firebase project is configured — on a device keeping its
 * own collection there is nobody to be.
 *
 * Before an owner has been nominated the signed-in id is printed here, because
 * that is the one thing the setup needs and the only way to learn it is to
 * sign in once and look.
 */
function Account({ viewer }: { viewer: Viewer }) {
  if (!viewer.signedIn) {
    return (
      <p className="account">
        <button className="btn" onClick={() => void signIn()}>
          Sign in to edit
        </button>
        <span className="account__note">
          Anyone can look. Only the owner’s account can change anything.
        </span>
      </p>
    )
  }

  return (
    <p className="account">
      <span className="label">
        {viewer.name}
        {viewer.isOwner ? '' : ' · read only'}
      </span>
      <button className="btn btn--quiet" onClick={() => void signOut()}>
        Sign out
      </button>
      {!ownerConfigured && (
        <span className="account__note">
          No owner is set yet. Put this in <code>VITE_OWNER_UID</code> and in
          firestore.rules: <code className="account__uid">{viewer.uid}</code>
        </span>
      )}
    </p>
  )
}
