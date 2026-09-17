// The one Firebase app, made on whichever side asks for it first.
//
// Both the store and the sign-in need it, and neither can assume the other has
// run: the store is fetched when the collection is first read, sign-in when the
// page first asks who is looking, and those race. Asking here means whoever
// gets there first creates it and the other finds it already made.

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { firebaseConfig } from './config'

export const firebaseApp = (): FirebaseApp =>
  getApps().length ? getApp() : initializeApp(firebaseConfig)
