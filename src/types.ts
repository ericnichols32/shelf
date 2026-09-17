// What a thing on the shelf is, and the two states it can be in.

/** On the shelf, or still being chased. */
export type Status = 'owns' | 'wants'

export type CategoryId = 'vinyl' | 'bluray' | 'books' | 'lego' | 'switch'

export interface Item {
  id: string
  category: CategoryId
  status: Status
  /** The album, film, book, set or game. */
  title: string
  /** Artist, director, author, theme or publisher — whatever the category calls it. */
  creator: string
  year: string
  /** The category's odd extra field: a set number, a pressing, an edition. */
  detail: string
  /**
   * The one word a shelf tags its things with — how a record was come by, which
   * edition of a film. What it means is the shelf's business; see
   * Category.tagGroup.
   */
  tag: string
  /** Image URL for the cover. Blank is fine; the card draws a typographic one. */
  cover: string
  /** Drop the white background out of the cover, leaving the box on the page. */
  cutout: boolean
  /**
   * A catalogue number found during lookup — an ISBN for a book, and nothing
   * at all for most things. It never appears in the form; it exists so a buy
   * link can point at the exact product page instead of a search.
   */
  ref: string
  /** Where to buy it. Blank falls back to the category's usual shop. */
  link: string
  notes: string
  addedAt: number
}

/** Everything about an item except the two fields the store assigns. */
export type NewItem = Omit<Item, 'id' | 'addedAt'>

export const EMPTY_ITEM: NewItem = {
  category: 'vinyl',
  status: 'owns',
  title: '',
  creator: '',
  year: '',
  detail: '',
  tag: '',
  cover: '',
  cutout: false,
  ref: '',
  link: '',
  notes: '',
}

/**
 * A checkbox at the front of a title, left over from a list pasted out of a
 * notes app: `[ ] Heat`, `[x] Heat`. Never part of a real title, so it is safe
 * to take off — unlike the brackets in "The Heat [DVD]", which this leaves
 * alone because it only ever looks at the very start.
 */
export const stripCheckbox = (title: string) =>
  title.replace(/^\s*\[\s*[xX\u2713\u2714]?\s*\]\s*/, '').trim()

/**
 * Items written before the owns/wants rename, before `ref`, and back when the
 * tag was called `acquired`, come back missing fields or using the old names.
 * Straighten them out on the way out of storage so nothing downstream has to
 * test for undefined.
 */
export function normalise(
  raw: Omit<Partial<Item>, 'status'> & { status?: string; acquired?: string },
): Item {
  const { acquired, ...rest } = raw
  const status: Status =
    raw.status === 'owned' || raw.status === 'owns' ? 'owns' : 'wants'
  return {
    ...EMPTY_ITEM,
    ...rest,
    status,
    tag: rest.tag || acquired || '',
    // Repairs titles imported before the parser knew about checkboxes.
    title: stripCheckbox(rest.title ?? ''),
  } as Item
}
