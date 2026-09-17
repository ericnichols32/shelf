// The Firebase project's four values, and whether they are filled in.
//
// Kept apart from firebase.ts on purpose: asking "is the cloud configured?"
// must not drag in the Firebase SDK, which is several hundred kilobytes and
// the largest thing in the build by some way.

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True when .env.local has been filled in from the Firebase console. */
export const cloudConfigured = Boolean(
  firebaseConfig.projectId && firebaseConfig.apiKey,
)

/**
 * The one Google account allowed to write, by its Firebase user id.
 *
 * Kept here rather than in auth.ts so that asking "has an owner been set?"
 * does not drag in the Firebase SDK.
 */
export const ownerUid = import.meta.env.VITE_OWNER_UID ?? ''

/** False during first-time setup, before an owner has been nominated. */
export const ownerConfigured = Boolean(ownerUid)
