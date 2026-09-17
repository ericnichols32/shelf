import { createContext, useContext } from 'react'

/**
 * Whether this visitor may change anything.
 *
 * True on a device with no cloud configured — the collection is that browser's
 * own and nobody else can see it. On a deployed copy it is true only for the
 * owner's signed-in account. Everything that writes asks this before offering
 * itself; Firestore's rules are what actually enforce it.
 */
export const CanEdit = createContext(false)

export const useCanEdit = () => useContext(CanEdit)
