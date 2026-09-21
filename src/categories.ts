// The five shelves: what each one calls its fields, and where each one shops.

import type { CategoryId, Item, Status } from './types'

export interface BuyLink {
  /** What the button says — a shop's name, never a URL. */
  label: string
  href: string
}

export interface BuyLinks {
  primary: BuyLink
  /** Offered underneath, for shelves where one shop is tried before another. */
  secondary?: BuyLink
  /** A line above the button, for shelves that want to say something first. */
  note?: string
}

export interface Category {
  id: CategoryId
  /** Display name, as a heading. */
  name: string
  /** Lowercase noun for running text: "no records yet". */
  noun: string
  /** An example title for the empty Title box. */
  titleHint: string
  creatorLabel: string
  creatorHint: string
  detailLabel: string
  detailHint: string
  /** Cover aspect ratio, width / height. A record is square, a book is not. */
  ratio: number
  /**
   * Which half of "A - B" is the title, in a pasted list.
   *
   * Music is written artist first — *Anderson .Paak - Malibu* — and everything
   * else here is written title first: *Piranesi - Susanna Clarke*, *Heat -
   * Michael Mann*. Guessing wrong silently files a record under the wrong name,
   * so the importer shows what it made of your first line before it commits.
   */
  listOrder?: 'creator-first' | 'title-first'
  /**
   * Filter the shelf by its maker field rather than by a tag.
   *
   * For LEGO the theme — Ideas, Art, Harry Potter — is what you would browse
   * by, and it arrives from LEGO with each set rather than from a fixed list,
   * so the filters are built from whatever themes are actually on the shelf.
   */
  filterByCreator?: boolean
  /**
   * A cut-out cover fills the same frame an uncut one does, rather than being
   * stood at a common height in a wider tile (see cutRatio). For books: they
   * aren't a row of identical cases, and a cut-out jacket should be as big as
   * its neighbours' framed ones.
   */
  cutFillsFrame?: boolean
  /**
   * Feed cards show the artwork edge to edge, with no white mount around it —
   * a record sleeve or a book jacket is the object itself, the way it is on
   * the item's page.
   */
  frameless?: boolean
  /** Offers the crate view — one at a time, flicked through — beside the grid. */
  crate?: boolean
  /** An extra single-choice field, for shelves that want one. */
  tagGroup?: {
    label: string
    /**
     * What the field is called for something already owned.
     *
     * A wanted disc has a *preferred* format — it is a wish. One on the shelf
     * simply has a format. Same field, and the difference is only wording.
     */
    labelWhenOwned?: string
    options: string[]
    /** Wording for the filter tabs, where a plural usually reads better. */
    tabLabels?: Record<string, string>
  }
  /** The heading above the buy button on an item's page. */
  buyHeading: string
  links: (item: Item) => BuyLinks
}

const q = (...parts: string[]) =>
  encodeURIComponent(parts.filter(Boolean).join(' ').trim())

/**
 * Shops we know the proper spelling of. Anything else gets its domain
 * title-cased, which is wrong often enough to be worth this list.
 */
const SHOP_NAMES: Record<string, string> = {
  'roughtrade.com': 'Rough Trade',
  'gruv.com': 'Gruv',
  'mcnallyjackson.com': 'McNally Jackson',
  'lego.com': 'LEGO',
  'bricklink.com': 'BrickLink',
  'brickset.com': 'Brickset',
  'nintendo.com': 'Nintendo',
  'discogs.com': 'Discogs',
  'bookshop.org': 'Bookshop',
  'amazon.com': 'Amazon',
  'ebay.com': 'eBay',
  'etsy.com': 'Etsy',
  'target.com': 'Target',
  'walmart.com': 'Walmart',
}

/** The name to print on a button for a link somebody pasted in by hand. */
export function shopName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (SHOP_NAMES[host]) return SHOP_NAMES[host]
    const name = host.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return 'the link'
  }
}

export const CATEGORIES: Category[] = [
  {
    id: 'vinyl',
    name: 'Vinyls',
    noun: 'records',
    titleHint: 'Rumours',
    creatorLabel: 'Artist',
    creatorHint: 'Fleetwood Mac',
    listOrder: 'creator-first',
    frameless: true,
    crate: true,
    detailLabel: 'Pressing',
    detailHint: '2021 reissue, clear',
    ratio: 1,
    tagGroup: {
      label: 'Acquired',
      options: ['Thrift', 'Brand New', 'Stoop', 'Travelling', 'Gifted'],
    },
    buyHeading: 'Preferred seller',
    links: (i) => ({
      note: 'Your local record store, or',
      primary: {
        label: 'Rough Trade',
        href: `https://www.roughtrade.com/en-us/search?q=${q(i.title, i.creator)}`,
      },
    }),
  },
  {
    id: 'bluray',
    name: 'Blu-rays',
    noun: 'discs',
    titleHint: 'Heat',
    creatorLabel: 'Director',
    creatorHint: 'Michael Mann',
    detailLabel: 'Edition',
    detailHint: 'Criterion #712',
    ratio: 2 / 3,
    tagGroup: {
      label: 'Preferred format',
      labelWhenOwned: 'Format',
      options: ['Steelbook', 'Criterion', '4K', 'Regular Blu-ray'],
    },
    buyHeading: 'Where to buy',
    links: (i) => ({
      primary: {
        label: 'Gruv',
        href: `https://www.gruv.com/search?q=${q(i.title)}`,
      },
    }),
  },
  {
    id: 'books',
    name: 'Books',
    noun: 'books',
    titleHint: 'Piranesi',
    creatorLabel: 'Author',
    creatorHint: 'Ursula K. Le Guin',
    detailLabel: 'Edition',
    detailHint: 'Hardcover, 1st',
    ratio: 2 / 3,
    cutFillsFrame: true,
    frameless: true,
    tagGroup: {
      label: 'Kind',
      options: ['Novel', 'Cookbook', 'Graphic Novel', 'Coffee table'],
      tabLabels: {
        Novel: 'Novels',
        Cookbook: 'Cookbooks',
        'Graphic Novel': 'Graphic Novels',
        'Coffee table': 'Coffee Table',
      },
    },
    buyHeading: 'Where to buy',
    // McNally Jackson's product pages are keyed on ISBN, so with one in hand
    // this is the exact book rather than a search. It is a guess at the right
    // edition though — their site has no linkable search to fall back on, and
    // an ISBN they don't stock gives a not-found page — so Bookshop, whose
    // search always resolves, sits underneath.
    links: (i) => {
      const bookshop = {
        label: 'Bookshop',
        href: `https://bookshop.org/search?keywords=${q(i.title, i.creator)}`,
      }
      if (!i.ref) return { primary: bookshop }
      return {
        primary: {
          label: 'McNally Jackson',
          href: `https://www.mcnallyjackson.com/book/${encodeURIComponent(i.ref)}`,
        },
        secondary: bookshop,
      }
    },
  },
  {
    id: 'lego',
    name: 'LEGO',
    noun: 'sets',
    titleHint: 'Rivendell',
    creatorLabel: 'Theme',
    creatorHint: 'Icons',
    filterByCreator: true,
    detailLabel: 'Set number',
    detailHint: '10497',
    ratio: 4 / 3,
    buyHeading: 'Where to buy',
    // Searching lego.com for a set number redirects to that set's page, even a
    // retired one, so the official shop is tried first as asked. BrickLink sits
    // underneath for the sets LEGO no longer lists at all. Both want the
    // number, not the name: "Atari 2600 Icons" finds nothing on either.
    links: (i) => {
      const key = i.detail || i.title
      return {
        primary: {
          label: 'LEGO',
          href: `https://www.lego.com/en-us/search?q=${q(key)}`,
        },
        secondary: {
          label: 'BrickLink',
          href: `https://www.bricklink.com/v2/search.page?q=${q(key)}`,
        },
      }
    },
  },
  {
    id: 'switch',
    name: 'Video Games',
    noun: 'games',
    titleHint: 'Mario Kart World',
    creatorLabel: 'Publisher',
    creatorHint: 'Nintendo',
    detailLabel: 'Format',
    detailHint: 'Game-Key Card',
    // Square, to match Nintendo's own cover art: the synced games come with
    // square key art, and a tall frame would crop the sides off every one.
    ratio: 1,
    tagGroup: {
      label: 'Console',
      options: ['Nintendo Switch', 'Nintendo Switch 2'],
    },
    buyHeading: 'Where to buy',
    links: (i) => ({
      primary: {
        label: 'Nintendo',
        href: `https://www.nintendo.com/us/search/#q=${q(i.title)}&p=1&cat=gme`,
      },
    }),
  },
]

/**
 * The shape of the tile a cut-out cover sits in.
 *
 * Wider than the one a photograph gets, and deliberately so. A cut-out is
 * scaled to match its neighbours by height — the way cases of the same kind
 * match on a real shelf — and that only works if the tile is wide enough for
 * the object to reach full height without its sides running out of room. At
 * the photo ratio a Blu-ray case is wider than its tile, so width would always
 * decide the size and every slightly different photograph would come out a
 * different height.
 */
export const cutRatio = (category: Category): number =>
  category.cutFillsFrame ? category.ratio : Math.max(category.ratio, 1.1)

/** How much of its tile a cut-out takes: all of it, or a margin's worth less. */
export const cutFill = (category: Category): number =>
  category.cutFillsFrame ? 1 : 0.94

/** What to call a shelf's tag, which depends on whether the thing is owned. */
export function tagLabel(category: Category, status: Status): string {
  const group = category.tagGroup
  if (!group) return ''
  return status === 'owns' ? (group.labelWhenOwned ?? group.label) : group.label
}

/** What a filter tab says: the plural, where one has been given. */
export const tagTabLabel = (category: Category, option: string): string =>
  category.tagGroup?.tabLabels?.[option] ?? option

export const byId = (id: string): Category | undefined =>
  CATEGORIES.find((c) => c.id === id)

/**
 * Where an item's buttons point.
 *
 * A link typed in by hand always wins, and takes the button's name from its
 * own domain — paste a Rough Trade URL and the button says Rough Trade.
 */
export function buyLinks(item: Item): BuyLinks {
  const category = byId(item.category)
  const manual = item.link.trim()
  if (manual) {
    return { primary: { label: shopName(manual), href: manual } }
  }
  return (
    category?.links(item) ?? { primary: { label: 'Search', href: '' } }
  )
}
