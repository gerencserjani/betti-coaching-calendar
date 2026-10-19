# Domain context: betti-coaching-calendar

Single-context glossary and data-model map for this repo (see `docs/agents/domain.md` for how agent skills consume this file). Kept up to date at the end of each multi-tenant migration task -- this is the one place to look to see the current shape of the hierarchy and what's still pending.

## Glossary

- **Tenant** -- one independent coaching business. The top-level isolation boundary: everything else hangs off a `tenantId`, directly or (for resources owned by a specific `Coach`) transitively.
- **Coach** -- a person who can be booked, and who may also hold account-management rights over other coaches in the same tenant. Always belongs to exactly one `Tenant`. Three roles:
  - **ADMIN** -- cross-tenant "super admin". Sees/manages every tenant's data. Not scoped by its own `tenantId`.
  - **OWNER** -- tenant-scoped manager. Same account-management actions as ADMIN (create a coach, revoke a coach's sessions) but only for `COACH`-role coaches within its own tenant, and never another coach's calendar/event types/availability/bookings. Also themselves a bookable `COACH`.
  - **COACH** -- plain bookable coach. No management rights over other coaches.
- **EventType** -- a bookable service a `Coach` offers (title, duration, locations, price). Scoped by `coachId`.
- **Booking** -- a client's appointment against one `EventType`/`Coach`. Scoped by `coachId`.
- **Settings** -- a `Tenant`'s business profile (address, cancellation-notice window, timezone). One row per tenant.
- **GoogleIntegration** -- the Google account used to mint Meet links for bookings. **Not yet tenant-scoped** -- see "Pending" below.

## Hierarchy

```mermaid
erDiagram
    TENANT ||--o{ COACH : "has"
    TENANT ||--|| SETTINGS : "has"
    COACH ||--o{ EVENT_TYPE : "offers"
    COACH ||--o{ BOOKING : "is booked for"
    COACH ||--o{ WEEKLY_AVAILABILITY : "sets"
    COACH ||--o{ AVAILABILITY_OVERRIDE : "sets"
    EVENT_TYPE ||--o{ BOOKING : "is booked as"

    TENANT {
        string id
        string name
    }
    COACH {
        string id
        string tenantId
        string role "ADMIN | OWNER | COACH"
    }
    SETTINGS {
        string tenantId
        string businessAddress
        int cancellationNoticeHours
        string businessTimezone
    }
```

## Role reach, at a glance

| Action                                                            | ADMIN        | OWNER                                 | COACH      |
| ----------------------------------------------------------------- | ------------ | ------------------------------------- | ---------- |
| View/manage own calendar, event types, availability               | own only     | own only                              | own only   |
| View/manage **another coach's** calendar/event types/availability | any tenant   | never                                 | never      |
| Create a coach account / revoke a coach's sessions                | any tenant   | own tenant, `COACH`-role targets only | never      |
| View the tenant's coach roster                                    | every tenant | own tenant                            | own tenant |
| Update tenant Settings (address/timezone/cancellation policy)     | any tenant   | own tenant                            | never      |

## Migration status (multi-tenant rollout)

Tracked as GitHub issues in this repo; update this table as each lands.

| Area                                                                                        | Status     | Issue |
| ------------------------------------------------------------------------------------------- | ---------- | ----- |
| `Tenant` entity, `Coach.tenantId`, `OWNER` role, cross-coach availability-conflict scoping  | ✅ Done    | #11   |
| Per-tenant `Settings`                                                                       | ✅ Done    | #12   |
| Per-coach/tenant Google Calendar integration (`GoogleIntegration` still a global singleton) | ⏳ Pending | #2    |
| Tenant-aware email sending (still one shared Gmail sender)                                  | ⏳ Pending | #13   |
| Tenant-aware `FRONTEND_URL`/domain resolution                                               | ⏳ Pending | #14   |
| Multiple coach-users per tenant beyond ADMIN/OWNER/COACH (future idea)                      | 💭 Idea    | #15   |
| Guest/client user accounts for booking (future idea)                                        | 💭 Idea    | #16   |
| Tenant/coach id on queued notification jobs, for log observability                          | ⏳ Pending | #17   |

**Known gap until #14 ships:** the public, unauthenticated endpoints (event-types catalog, slots, booking creation) have no tenant-resolution mechanism yet and behave as "one implicit tenant". `Settings.getForPublicRequest()` and `GoogleIntegration` both currently resolve to "whichever tenant exists" rather than a real per-request tenant. **Don't onboard a second tenant before #14 ships.**
