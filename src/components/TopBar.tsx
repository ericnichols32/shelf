import { useEffect, useRef, useState } from 'react'
import { CATEGORIES } from '../categories'
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
