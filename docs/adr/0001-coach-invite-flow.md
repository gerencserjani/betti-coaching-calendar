# ADR-0001: Coach invite flow -- creation, activation, and one-coach-per-site

Status: Accepted (2026-10-20). Implements backend issue #32.

## Context

A new coach's account used to be provisioned by an admin picking a password
for them directly (`POST /coaches` with `email`, `name`, `password`). The
goal was to switch to invite-based onboarding: the admin names a new coach,
the backend emails them a link, and the coach sets her own password. Three
separate design questions came up along the way, each settled by direct
back-and-forth rather than decided upfront.

## Decision 1: the invite creates the Coach -- there is no pre-created account

**Considered:** `POST /coaches` creates a `Coach` row immediately
(`email`+`name`, `passwordHash` nullable, a new `activatedAt` timestamp);
`POST /coaches/:id/invite` sends the email separately; login is rejected
with a distinct "not yet activated" error until `accept-invite` fills in the
password. This was fully implemented, including a migration, before being
rejected.

**Why rejected:** it leaves a half-formed, editable-later account sitting in
the DB for however long the invite goes unused -- "ugly", in the word that
ended the discussion. There was also no real use case for a `Coach` existing
without a password; the only reason to create it early was to have
_something_ to attach the invite to.

**Decision:** `POST /coaches` doesn't touch the database at all. It mints a
signed, 7-day, purpose-scoped token (`TokenService.signCoachInviteToken` /
`verifyCoachInviteToken`, the same pattern already used for the Google OAuth
connect-state token) carrying `email` + `name` (see decision 3 for the third
field it carries), and emails an accept-link built from it. The `Coach` row
is created for the first time, complete, by `POST /coaches/accept-invite`:
email + name + password all together. There is no `activatedAt` field and no
"not yet activated" login error, because there is no state in between
"doesn't exist" and "fully set up."

Consequence: re-sending a lost invite is just calling `POST /coaches` again
with the same email -- nothing was persisted the first time, so there's
nothing to collide with.

## Decision 2: one coach per site -- not modeled as `AllowedOrigin.coachId`

Once the invite needed to know _which frontend_ the new coach belongs to
(for the accept-link, and to stop an admin from accidentally inviting a
second coach to a site that already has one), two shapes were tried.

**First attempt (built, then reverted):** add `AllowedOrigin.coachId`
(nullable, `@unique`), claimed by `acceptInvite()` in the same transaction
as creating the `Coach`.

**Why reverted:** `AllowedOrigin` is deliberately a separate, global,
coach-agnostic concept -- the CORS allow-list, read only by `main.ts`'s
origin callback. Overloading it with coach-ownership semantics was flagged
as a bad idea mid-build: a CORS table shouldn't need to know who owns each
entry to do its one job.

**Decision:** ownership lives on `Coach` instead: `Coach.frontendUrl`
(nullable, `@unique`). `AllowedOrigin` stays exactly what it was.
`CoachesService.invite()` reads `AllowedOrigin` (read-only, no FK) purely to
validate that the admin-supplied `frontendUrl` is a real, known site (404 if
not), and separately checks no other `Coach` already has that `frontendUrl`
(409 if so). The admin tool's "Invite coach" form sources its Site URL field
from the same `GET /allowed-origins` list as a dropdown -- picking from known
sites rather than typing a URL freehand -- filtered client-side to exclude
sites a `Coach` already owns, as a UX convenience on top of the server-side
rule.

## Decision 3: race safety is the `@unique` constraint, not a pre-check

Two `accept-invite` calls for the same site (e.g. two different invites to
the same `frontendUrl`, both accepted around the same time) can't be fully
prevented by a check-then-write in application code -- that's inherently
racy. `Coach.frontendUrl @unique` is the real backstop: `acceptInvite()`
doesn't pre-check whether `frontendUrl` is already taken at all (the earlier
`invite()` call already did, but that's a different request, possibly
minutes or days earlier); it just attempts `coach.create()` with
`frontendUrl` included, and if another coach claimed that site in between,
Postgres rejects the second `create()` with a unique-constraint violation.
This surfaces as a clean `409` via the existing global
`PrismaExceptionFilter` (`common/prisma-exception.filter.ts`), not a raw
500 -- that filter already existed for exactly this kind of race (originally
written for concurrent coach-creation on duplicate emails) and needed no
changes.

## Final shape

- `POST /coaches` (ADMIN-only): `{ email, name, frontendUrl }` → 204, no DB
  write. 404 if `frontendUrl` isn't an `AllowedOrigin`; 409 if `email` or
  `frontendUrl` already belongs to a coach.
- `POST /coaches/accept-invite` (public): `{ token, password }` → creates
  the `Coach` (email + name + password + frontendUrl together) and returns
  an access token, same shape as `POST /auth/login`. 409 if the email or
  the site got claimed in the meantime; 401 on an invalid/expired token.
- `Coach.frontendUrl String? @unique` is the only new column. No
  `activatedAt`, no nullable `passwordHash`, no `AllowedOrigin.coachId`.

See `CONTEXT.md`'s "Coach onboarding (invite flow)" and "One coach per
site" glossary entries for the current-state summary; this document is the
why and the road not taken.
