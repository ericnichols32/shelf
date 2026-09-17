import { cloudConfigured } from './config'
import { createLocalStore } from './local'
import type { Item } from '../types'
import type { Store } from './types'

export type { Store } from './types'
export { cloudConfigured }

/**
 * A cloud store that has not finished arriving yet.
 *
 * The Firebase SDK is the biggest thing in the build, so it is fetched only
 * when the project is actually configured, and only after the first paint.
 * This stands in until it lands: subscriptions are held and rewired, and the
 * three writes wait on the import. Nothing upstream has to know.
 */
function createDeferredCloudStore(): Store {
  let real: Store | null = null
  const listeners = new Set<(items: Item[]) => void>()
  const unsubscribes = new Map<(items: Item[]) => void, () => void>()

  const ready: Promise<Store> = import('./firebase').then(
    ({ createCloudStore }) => {
      real = createCloudStore()
      listeners.forEach((l) => unsubscribes.set(l, real!.subscribe(l)))
      return real
    },
  )

  return {
    mode: 'cloud',
    subscribe(listener) {
      listeners.add(listener)
      if (real) unsubscribes.set(listener, real.subscribe(listener))
      return () => {
        listeners.delete(listener)
        unsubscribes.get(listener)?.()
        unsubscribes.delete(listener)
      }
    },
    async add(item) {
      await (await ready).add(item)
    },
    async update(id, patch) {
      await (await ready).update(id, patch)
    },
    async remove(id) {
      await (await ready).remove(id)
    },
  }
}

let store: Store | null = null

/**
 * The app's one store, made on first ask.
 *
 * Firestore if it has been configured, this browser's storage if not — so the
 * app is usable the moment it is opened, before any of the setup in the README.
 */
export function getStore(): Store {
  if (!store) {
    store = cloudConfigured ? createDeferredCloudStore() : createLocalStore()
  }
  return store
}
