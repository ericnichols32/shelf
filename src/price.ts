/**
 * A price as it should read on the page.
 *
 * Stored in cents, exactly as the shop gives it, so nothing is lost; rounded
 * only for display. Anything ending in .99 reads as the next dollar up —
 * $169.99 is $170 — because that is what it is. Other prices are left alone,
 * and whole dollars drop their cents.
 */
export function formatPrice(cents: number): string {
  const rounded = cents % 100 === 99 ? cents + 1 : cents
  const dollars = rounded / 100
  return rounded % 100 === 0
    ? `$${dollars.toLocaleString('en-US')}`
    : `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
