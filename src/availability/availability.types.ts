export interface MinuteRange {
  startMinute: number;
  endMinute: number;
}

export function rangesOverlap(a: MinuteRange, b: MinuteRange): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}
