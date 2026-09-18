import { rangesOverlap } from './availability.types.js';

describe('rangesOverlap', () => {
  it('returns true for fully overlapping ranges', () => {
    expect(
      rangesOverlap(
        { startMinute: 60, endMinute: 120 },
        { startMinute: 60, endMinute: 120 },
      ),
    ).toBe(true);
  });

  it('returns true for partially overlapping ranges', () => {
    expect(
      rangesOverlap(
        { startMinute: 60, endMinute: 120 },
        { startMinute: 90, endMinute: 150 },
      ),
    ).toBe(true);
    expect(
      rangesOverlap(
        { startMinute: 90, endMinute: 150 },
        { startMinute: 60, endMinute: 120 },
      ),
    ).toBe(true);
  });

  it('returns true when one range fully contains the other', () => {
    expect(
      rangesOverlap(
        { startMinute: 0, endMinute: 200 },
        { startMinute: 60, endMinute: 120 },
      ),
    ).toBe(true);
  });

  it('returns false for adjacent, non-overlapping ranges (touching at the boundary)', () => {
    expect(
      rangesOverlap(
        { startMinute: 60, endMinute: 120 },
        { startMinute: 120, endMinute: 180 },
      ),
    ).toBe(false);
  });

  it('returns false for completely disjoint ranges', () => {
    expect(
      rangesOverlap(
        { startMinute: 0, endMinute: 30 },
        { startMinute: 200, endMinute: 240 },
      ),
    ).toBe(false);
  });
});
