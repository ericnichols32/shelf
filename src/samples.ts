// A handful of things to look at before a shelf has anything real on it.
//
// Loaded only when you ask for them, from the empty state, and removable like
// anything else. The covers are deliberately left blank: adding these runs the
// same lookup the form does, so they arrive with real artwork and are a fair
// demonstration rather than a rigged one.

import { EMPTY_ITEM, type NewItem } from './types'

const item = (fields: Partial<NewItem>): NewItem => ({ ...EMPTY_ITEM, ...fields })

export const SAMPLES: NewItem[] = [
  item({
    category: 'vinyl', status: 'owns', title: 'Rumours', creator: 'Fleetwood Mac',
    year: '1977', detail: '2011 reissue', tag: 'Thrift',
    notes: 'Sleeve is rough but it plays clean.',
  }),
  item({
    category: 'vinyl', status: 'owns', title: 'Songs in the Key of Life',
    creator: 'Stevie Wonder', year: '1976', tag: 'Stoop',
  }),
  item({
    category: 'vinyl', status: 'wants', title: 'Blonde', creator: 'Frank Ocean',
    year: '2016', detail: 'Black Friday pressing',
    notes: 'Originals go for a fortune. Waiting for a repress.',
  }),
  item({
    category: 'bluray', status: 'owns', title: 'Heat', creator: 'Michael Mann',
    year: '1995', detail: '4K restoration', tag: '4K',
  }),
  item({
    category: 'bluray', status: 'wants', title: 'Chungking Express',
    creator: 'Wong Kar-wai', year: '1994', detail: 'Criterion #453', tag: 'Criterion',
    notes: 'Wait for the half-price Criterion sale.',
  }),
  item({
    category: 'books', status: 'owns', title: 'The Dispossessed',
    creator: 'Ursula K. Le Guin', year: '1974', detail: 'Paperback',
  }),
  item({
    category: 'books', status: 'wants', title: 'Piranesi',
    creator: 'Susanna Clarke', year: '2020', detail: 'Hardcover',
  }),
  item({
    category: 'lego', status: 'owns', title: 'Concorde', creator: 'Icons',
    year: '2023', detail: '10318',
  }),
  item({
    category: 'lego', status: 'wants', title: 'Atari 2600', creator: 'Icons',
    year: '2022', detail: '10306',
    notes: 'Retired, so LEGO may send you to BrickLink.',
  }),
  item({
    category: 'switch', status: 'owns', title: 'Mario Kart World',
    creator: 'Nintendo', year: '2025', detail: 'Game card',
  }),
  item({
    category: 'switch', status: 'wants', title: 'Metroid Prime 4: Beyond',
    creator: 'Nintendo', year: '2025', detail: 'Game-Key Card',
  }),
]
