// Something that hasn't come out yet.
//
// A pre-order is a different sort of wish: the shop will take your money, but
// nothing arrives for months. The shelf says so plainly rather than showing it
// as one more thing you could go and buy this afternoon.

/** True when the date is still ahead of today. */
export function isUpcoming(released?: string): boolean {
  if (!released) return false
  const day = new Date(`${released}T00:00:00`)
  if (Number.isNaN(day.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return day.getTime() > today.getTime()
}

/**
 * A shop with no date yet files the thing under the last day of the year —
 * "31 December 2027" means "sometime in 2027", and saying December would be
 * making it up.
 */
const vague = (released: string) => released.slice(5) === '12-31'

/** "Feb 2027", or just "2027" where the shop has only said a year. */
export function shortWhen(released: string): string {
  if (vague(released)) return released.slice(0, 4)
  const day = new Date(`${released}T00:00:00`)
  return day.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** "Out 12 February 2027", or "Out sometime in 2027". */
export function longWhen(released: string): string {
  if (vague(released)) return `Out sometime in ${released.slice(0, 4)}`
  const day = new Date(`${released}T00:00:00`)
  return `Out ${day.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`
}
