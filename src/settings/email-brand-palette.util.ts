import type {
  EmailBrandPalette,
  EmailPalette,
} from '../notifications/templates/BookingEmail.js';

// Mirrors EmailPalette's own fields (see BookingEmail.tsx) -- kept as a
// plain list here since class-validator can't express "this JSON blob has
// exactly these keys, each a hex color" declaratively.
const PALETTE_KEYS = [
  'bg',
  'bgPanel',
  'bgCard',
  'ink',
  'inkSoft',
  'accent',
  'accentSoft',
  'line',
  'brown',
] as const;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isValidPalette(value: unknown): value is EmailPalette {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return PALETTE_KEYS.every((key) => {
    const v = record[key];
    return typeof v === 'string' && HEX_COLOR_RE.test(v);
  });
}

/**
 * Validates Settings.emailBrandPalette's shape before it's persisted -- see
 * SettingsService.update(). Not run via class-validator (nested dynamic
 * JSON shapes aren't a good fit for it), same reasoning as the other
 * structural checks this codebase does directly in a service (e.g.
 * CoachesService.invite()/setFrontendUrl()).
 */
export function isValidEmailBrandPalette(
  value: unknown,
): value is EmailBrandPalette {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return isValidPalette(record.light) && isValidPalette(record.dark);
}
