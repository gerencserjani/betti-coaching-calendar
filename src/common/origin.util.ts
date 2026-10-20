const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * True for any http(s) origin on localhost/127.0.0.1/::1, any port --
 * always CORS-allowed regardless of the DB-backed allow-list (see
 * AllowedOriginsService), including against the production deployment.
 * This is what lets a locally-run tool (the admin tool) reach either the
 * local dev backend or the deployed one without first needing to be
 * registered anywhere -- solves the bootstrap problem of using a tool to
 * allow-list itself. Not a meaningful security loosening: the real auth
 * boundary for every sensitive endpoint is still the JWT bearer token, and
 * a localhost origin is only reachable by someone who already has access
 * to that machine.
 */
export function isLocalhostOrigin(origin: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * The calling frontend's own origin, for stamping onto a new Booking (see
 * BookingsService.create()) -- browsers always send `Origin` on a
 * cross-origin request like this one, so it's a reliable signal of which
 * coach's site a booking was made through. Falls back to deriving it from
 * `Referer` for the rare client that omits `Origin`; null if neither header
 * is present (a non-browser caller, e.g. a manual API test).
 */
export function resolveRequestOrigin(
  originHeader: string | undefined,
  refererHeader: string | undefined,
): string | null {
  if (originHeader) return originHeader;
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      return null;
    }
  }
  return null;
}
