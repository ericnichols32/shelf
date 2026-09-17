/** Who is looking. Kept apart from Firebase so it costs nothing to ask. */
export interface Viewer {
  signedIn: boolean
  /** True only for the one account allowed to write. */
  isOwner: boolean
  name: string
  /**
   * The signed-in account's id.
   *
   * Shown in the app while no owner has been nominated, because signing in
   * once is the only convenient way to discover what to put in VITE_OWNER_UID
   * and in firestore.rules.
   */
  uid: string
}

export const SIGNED_OUT: Viewer = {
  signedIn: false,
  isOwner: false,
  name: '',
  uid: '',
}
