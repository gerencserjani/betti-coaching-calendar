/** Mirrors betti-coaching's own src/format.ts formatPriceHuf exactly -- keep
 * the two in sync, same reasoning as BookingEmail.tsx's palette duplication
 * comment (the frontend's formatter can't be imported into this backend, or
 * vice versa, so this is a deliberate, matching copy, not a divergence).
 *
 * `null` returns `null` (render no price row at all -- see EventType.price),
 * distinct from `0` (the free label -- an explicit, deliberate "this costs
 * nothing"). Callers must omit the row themselves when this returns `null`.
 */
export function formatPriceHuf(
  priceHuf: number | null,
  locale: string,
  freeLabel: string,
): string | null {
  if (priceHuf === null) return null;
  if (priceHuf <= 0) return freeLabel;
  const intlLocale = locale.startsWith('hu') ? 'hu-HU' : 'en-US';
  return `${new Intl.NumberFormat(intlLocale).format(priceHuf)} HUF`;
}
