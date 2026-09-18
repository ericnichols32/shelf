// Moving one thing along a list, in a single write.
//
// Each item carries a number and the list is sorted by it. To move something,
// give it a number between its new neighbours' numbers — no renumbering, so a
// move costs one write whether the list holds five things or five hundred.

import { position, type Item } from './types'

/**
 * The number to give `list[from]` so that it lands at `to`.
 *
 * Returns null when there is nowhere to go.
 */
export function sortForMove(
  list: Item[],
  from: number,
  to: number,
): number | null {
  if (to < 0 || to >= list.length || to === from) return null

  // Where the neighbours are once the moved item is out of the way.
  const without = list.filter((_, i) => i !== from)
  const before = without[to - 1]
  const after = without[to]

  if (!before) return position(after) - 1
  if (!after) return position(before) + 1
  return (position(before) + position(after)) / 2
}
