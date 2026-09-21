import { useEffect, useRef, useState } from 'react'
import { byId, CATEGORIES } from '../categories'
import { setView, useView } from '../viewmode'
import { go } from '../route'

export default function TopBar({
  back,
  shelfMenu,
  theme,
  onTheme,
}: {
  back?: { label: string; to: string }
  /** Shelf pages get a way across to the others instead of a way back. */
  shelfMenu?: { current: string }
  theme: 'light' | 'dark'
  onTheme: () => void
}) {
  return (
    <div className="topbar">
      {shelfMenu ? (
        <ShelfMenu current={shelfMenu.current} />
      ) : back ? (
        <button className="backlink" onClick={() => go(back.to)}>
          &larr; {back.label}
        </button>
      ) : (
        <span className="label">Collection &amp; Wish List</span>
      )}
      <span className="topbar__spacer" />
      {shelfMenu && byId(shelfMenu.current)?.altView && (
        <ViewSwitch shelf={shelfMenu.current} alt={byId(shelfMenu.current)!.altView!} />
      )}
      <button
        className="iconbtn"
        onClick={onTheme}
        aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  )
}

/** Grid, or the shelf's browsing view — the crate or the bookshelf. */
function ViewSwitch({ shelf, alt }: { shelf: string; alt: 'crate' | 'shelf' }) {
  const view = useView(shelf)
  return (
    <div className="viewswitch" role="group" aria-label="How to show this shelf">
      <button
        className="viewswitch__btn"
        aria-pressed={view === 'grid'}
        aria-label="Grid"
        title="Grid"
        onClick={() => setView(shelf, 'grid')}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="1.5" width="5.5" height="5.5" />
          <rect x="9" y="1.5" width="5.5" height="5.5" />
          <rect x="1.5" y="9" width="5.5" height="5.5" />
          <rect x="9" y="9" width="5.5" height="5.5" />
        </svg>
      </button>
      <button
        className="viewswitch__btn"
        aria-pressed={view === alt}
        aria-label={alt === 'crate' ? 'Crate — one at a time' : 'Bookshelf'}
        title={alt === 'crate' ? 'Crate' : 'Bookshelf'}
        onClick={() => setView(shelf, alt)}
      >
        {alt === 'crate' ? (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 1.5h7M3 4h10" />
            <rect x="1.5" y="6.5" width="13" height="8" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1 14.5h14" />
            <rect x="2.5" y="4" width="2.5" height="10.5" />
            <rect x="5.5" y="2" width="3" height="12.5" />
            <path d="M10 5.2l2.4-.6 2.3 9.4-2.4.6z" />
          </svg>
        )}
      </button>
    </div>
  )
}

/**
 * Jump straight to another shelf.
 *
 * On a shelf page, going "back" only ever meant the home page, which is itself
 * a list of shelves — so this is that list, one tap earlier.
 */
function ShelfMenu({ current }: { current: string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const jump = (to: string) => {
    setOpen(false)
    go(to)
  }

  return (
    <div className="shelfmenu" ref={wrap}>
      <button
        className="shelfmenu__button"
        aria-label="Go to another shelf"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="shelfmenu__bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>

      {open && (
        <div className="shelfmenu__panel" role="menu">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              role="menuitem"
              className="shelfmenu__item"
              aria-current={category.id === current}
              onClick={() => jump(`/c/${category.id}`)}
            >
              {category.name}
            </button>
          ))}
          <hr className="rule" />
          <button
            role="menuitem"
            className="shelfmenu__item shelfmenu__item--quiet"
            onClick={() => jump('/')}
          >
            Home
          </button>
        </div>
      )}
    </div>
  )
}
