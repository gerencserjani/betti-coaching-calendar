import { formatPriceHuf } from './price-format.util.js';

// hu-HU's Intl.NumberFormat grouping separator is a non-breaking space,
// visually indistinguishable from a regular space but not equal to one --
// built via fromCharCode rather than a literal/escaped character in source,
// since either is easy for tooling to silently mangle.
const NBSP = String.fromCharCode(160);

function withPlainSpaces(s: string): string {
  return s.split(NBSP).join(' ');
}

describe('formatPriceHuf', () => {
  it('returns null for null -- no price row at all, distinct from free', () => {
    expect(formatPriceHuf(null, 'hu', 'Díjmentes')).toBeNull();
  });

  it('returns the free label for zero', () => {
    expect(formatPriceHuf(0, 'hu', 'Díjmentes')).toBe('Díjmentes');
  });

  it('formats a positive price with hu-HU grouping for a hu locale', () => {
    expect(withPlainSpaces(formatPriceHuf(12500, 'hu', 'Díjmentes')!)).toBe(
      '12 500 HUF',
    );
  });

  it('formats a positive price with en-US grouping for a non-hu locale', () => {
    expect(formatPriceHuf(12500, 'en', 'Free')).toBe('12,500 HUF');
  });
});
