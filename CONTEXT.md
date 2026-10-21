# Domain context: coach-calendar

Single-context glossary and data-model map for this repo (see `docs/agents/domain.md` for how agent skills consume this file). Kept up to date as the data model evolves -- this is the one place to look to see the current shape of the hierarchy.

## Standing decision: one website = one Coach, always

Every `Coach` is its own fully independent business -- there is no separate "tenant" or "studio" grouping above it, and there never will be (the earlier idea of a studio with several coaches sharing one tenant, managed by an `OWNER`, was explicitly rejected -- see backend issue #15's closing comment).

This used to be modeled as two tables (`Tenant` + `Coach`, 1:1), introduced while multi-coach-per-business was still an open question. Once that was ruled out, `Tenant` was merged back into `Coach` -- `Settings` and `GoogleIntegration` now key directly on `coachId`, and the `OWNER` role (and the cross-coach availability-conflict checks it motivated) was removed as dead weight.

## Glossary

- **Coach** -- both the bookable person AND the whole business: one website, one `Coach` row. Two roles:
  - **ADMIN** -- cross-platform "super admin". Sees/manages every Coach's data. Not scoped to its own account for authorization purposes.
  - **COACH** -- a single business's own account. Manages only its own calendar/event types/settings/bookings.
- **EventType** -- a bookable service a `Coach` offers (title, duration, locations, price). Scoped by `coachId`.
- **Booking** -- a client's appointment against one `EventType`/`Coach`. Scoped by `coachId`.
- **Settings** -- a `Coach`'s business profile (address, cancellation-notice window, timezone). One row per coach.
- **GoogleIntegration** -- the Google account used to mint Meet links for a `Coach`'s bookings. One row per coach. The platform's own OAuth app (`GOOGLE_CLIENT_ID`/`SECRET`) stays global, shared across every coach's own connection -- same pattern as e.g. a "Sign in with Google" SaaS using one OAuth app for many end users' own Google accounts.
- **Email sending** -- two mechanisms, chosen per send by `EmailService`: Gmail SMTP (the original mechanism, shared across every coach that hasn't set up their own) is the default/fallback; Resend is used instead once a coach verifies their own domain and sets `Settings.emailFrom`. Resend's free tier covers 3 verified domains (3,000 emails/month) -- a paid tier would be needed beyond that.
- **Public request resolution** -- there's no domain/subdomain-based routing: the two public, unauthenticated endpoints with no other coach context (`GET /event-types`, `GET /settings`) take an explicit, required `?coachId=` query param instead. Each frontend deployment is configured with its own `VITE_COACH_ID` and sends it on every public call -- "one backend serves many independent frontends", each one naming itself explicitly rather than being inferred from its hostname. `POST /bookings`, `GET /slots`, etc. never needed this: they always carry an `eventTypeId`/`manageToken` that already leads to a specific coach.
- **Booking email links, per coach** -- there's no global `FRONTEND_URL` anymore (removed): `Booking.originUrl` is stamped from the creating request's `Origin`/`Referer` header at `POST /bookings` time (see `common/origin.util.ts`'s `resolveRequestOrigin`, used in `BookingsController.create`), and every email about that booking (confirmed/cancelled/rescheduled) builds its links from that stored value instead of one site-wide setting. This is what makes a second coach's booking emails point at _their_ site instead of the first coach's.
- **Coach onboarding (invite flow)** -- a new coach is never created directly by an admin; the invite itself is what creates the `Coach` row, so there's never a half-formed account (email+name, no password) sitting in the DB. `POST /coaches` (admin-only; `email`, `name`, `frontendUrl`) mints a signed, 7-day, purpose-scoped token carrying the email+name+frontendUrl (`TokenService.signCoachInviteToken`/`verifyCoachInviteToken`, same pattern as the Google-connect-state token) and emails an accept-link to it -- nothing is persisted, so re-sending (e.g. the first email got lost) is just calling it again. The invited coach submits a password to the public `POST /coaches/accept-invite`, which verifies the token and creates the `Coach` row for the first time with email+name+password+frontendUrl together, then logs them in (same response shape as `POST /auth/login`). This invite email always goes out through the shared Gmail sender (see "Email sending" above), never via Resend -- a per-coach `Settings.emailFrom` can't exist yet for a coach that doesn't exist yet.
- **One coach per site** -- `frontendUrl` must name one of the admin's already-allow-listed `AllowedOrigin` rows (see the `AllowedOrigin` model and #35): the admin tool offers a dropdown of known origins rather than a freehand URL field, and `CoachesService.invite()` rejects (404) anything that isn't a real `AllowedOrigin.origin`. **`AllowedOrigin` itself is untouched by any of this** -- it stays a separate, global, coach-agnostic CORS allow-list, still only read by `main.ts`'s CORS callback via `AllowedOriginsService.isAllowed()`; `invite()` only reads it to validate the chosen URL, never writes to it, and there's no foreign key between the two tables. "Which coach owns this site" is instead just another fact on `Coach` itself: `Coach.frontendUrl @unique`. `invite()` rejects (409) if another coach already has that `frontendUrl`; `acceptInvite()` relies on the same `@unique` constraint as the real race-safety backstop (a Prisma unique-violation on create, turned into a 409 by the global `PrismaExceptionFilter`) in case two invites to the same site were both accepted around the same time. This is what stops two coaches from ever ending up sharing one frontend. The one seeded ADMIN account predates `invite()` and so never got a `frontendUrl` this way -- `PATCH /coaches/:id/frontend-url` (admin-only, `CoachesService.setFrontendUrl()`) exists to fix that up after the fact, with the same two checks as `invite()` (must be a known `AllowedOrigin`, must not already belong to a _different_ coach).
- **Forgot/reset password** -- `POST /auth/forgot-password` is deliberately silent (always `204`) on an email with no account, so it can't be used to enumerate which emails exist here. For a known email, it mints a short-lived (1h), purpose-scoped token (`TokenService.signPasswordResetToken`/`verifyPasswordResetToken`, same pattern as the invite token) and emails a reset link built from `coach.frontendUrl` when set, falling back to the calling request's own Origin/Referer (`resolveRequestOrigin`, same helper `Booking.originUrl` uses) for a coach who predates the invite flow and has no stored `frontendUrl` -- today, that's the one seeded ADMIN account. `POST /auth/reset-password` verifies the token, sets the new password, and revokes every session issued before the reset (`Coach.sessionsRevokedAt`, the same lever as the ADMIN "revoke sessions" action) before logging the coach straight back in. The fresh access token this issues is deliberately stamped with an explicit `iat` one second past `sessionsRevokedAt`'s own second -- `iat` only has whole-second resolution, so without this the brand-new token and a stale one from the same second would be indistinguishable to `JwtAuthGuard`'s revocation check. The reset token itself is single-use: unlike the invite token (naturally one-time, since redeeming it is what creates the Coach a replay would then fail to find), this coach exists both before and after, so `resetPassword()` instead rejects a token whose `iat` predates the coach's own `sessionsRevokedAt` -- the exact value it itself just bumped on the first successful use.

## Hierarchy

```mermaid
erDiagram
    COACH ||--o{ EVENT_TYPE : "offers"
    COACH ||--o{ BOOKING : "is booked for"
    COACH ||--o{ WEEKLY_AVAILABILITY : "sets"
    COACH ||--o{ AVAILABILITY_OVERRIDE : "sets"
    COACH ||--|| SETTINGS : "has"
    COACH ||--|| GOOGLE_INTEGRATION : "has"
    EVENT_TYPE ||--o{ BOOKING : "is booked as"

    COACH {
        string id
        string name
        string role "ADMIN | COACH"
    }
    SETTINGS {
        string coachId
        string businessAddress
        int cancellationNoticeHours
        string businessTimezone
        string emailFrom
    }
    GOOGLE_INTEGRATION {
        string coachId
        string connectedEmail
    }
```

## Role reach, at a glance

| Action                                                            | ADMIN     | COACH    |
| ----------------------------------------------------------------- | --------- | -------- |
| View/manage own calendar, event types, availability, settings     | own only  | own only |
| View/manage **another coach's** calendar/event types/settings     | any coach | never    |
| Invite a new coach account / revoke a coach's sessions / list all | yes       | never    |
| Update own Settings / connect own Google Calendar                 | yes       | yes      |

## Backend issue tracker

| Area                                                                                    | Status      | Issue |
| --------------------------------------------------------------------------------------- | ----------- | ----- |
| Per-coach Settings                                                                      | ✅ Done     | #12   |
| Per-coach Google Calendar integration                                                   | ✅ Done     | #2    |
| Coach-aware email sending (Gmail fallback + per-coach Resend once a domain is verified) | ✅ Done     | #13   |
| coachId-based resolution for the public, unauthenticated endpoints                      | ✅ Done     | #14   |
| Multiple coaches sharing one business account                                           | ❌ Rejected | #15   |
| Guest/client user accounts for booking (future idea)                                    | 💭 Idea     | #16   |
| Coach id on queued notification jobs, for log observability                             | ✅ Done     | #17   |
| Invite-based coach onboarding (no global `FRONTEND_URL`, no pre-created account)        | ✅ Done     | #32   |

**Current real-world state:** the one existing coach hasn't verified a Resend domain yet (`Settings.emailFrom` is null), so it's still sending through the Gmail fallback -- this is expected, not a bug. Once a domain is verified at resend.com and `Settings.emailFrom` is set, email switches over automatically.

**Deploy status (2026-10-20):** `main` is fully deployed in both repos, including #14/#17/#27/#32/#35 and the one-coach-per-site work (#39) -- production migrations applied (`add_booking_origin_url`, `coach_frontend_url`) and the backend redeployed to Cloud Run (still the `betti-coaching-calendar` service, not yet renamed). The frontend auto-deploys to Vercel on every merge to `main` regardless of backend deploy state; the backend itself is deployed to Cloud Run only when explicitly requested. A second coach/website can now actually go through the invite flow end to end in production.
