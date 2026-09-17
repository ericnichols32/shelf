// A hash router, about as small as one gets.
//
// Hash routing means the app can be opened from a file, a dev server or any
// static host without the host needing to know about the routes.

import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  /** Adding from the home page, before a shelf has been chosen. */
  | { name: 'choose' }
  | { name: 'category'; category: string }
  | { name: 'new'; category: string }
  | { name: 'import'; category: string }
  | { name: 'item'; id: string }
  | { name: 'edit'; id: string }

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'new') return { name: 'choose' }
  if (parts[0] === 'c' && parts[1]) {
    if (parts[2] === 'new') return { name: 'new', category: parts[1] }
    if (parts[2] === 'import') return { name: 'import', category: parts[1] }
    return { name: 'category', category: parts[1] }
  }
  if (parts[0] === 'i' && parts[1]) {
    return parts[2] === 'edit'
      ? { name: 'edit', id: parts[1] }
      : { name: 'item', id: parts[1] }
  }
  return { name: 'home' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (to: string) => {
  location.hash = to
}

export const back = () => history.back()

/**
 * Share mode: the app is read-only and every control that writes is gone.
 *
 * The honest description of this is a courtesy rather than a lock. What makes
 * it real rather than cosmetic is on the Firestore side — a browser in share
 * mode never signs in, so the rules refuse its writes even if someone edits the
 * URL back. See firestore.rules.
 */
export const isShareMode = new URLSearchParams(location.search).has('share')

/** The link to hand someone: this app, read-only, on the current page. */
export const shareUrl = () =>
  `${location.origin}${location.pathname}?share${location.hash}`
