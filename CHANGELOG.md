# [1.20.0](https://github.com/gerencserjani/coach-calendar/compare/v1.19.0...v1.20.0) (2026-10-20)

### Features

- self-service forgot/reset password ([#42](https://github.com/gerencserjani/coach-calendar/issues/42)) ([a7beb5e](https://github.com/gerencserjani/coach-calendar/commit/a7beb5ee480358de97ce71a25f04a7514403735c))

# [1.19.0](https://github.com/gerencserjani/coach-calendar/compare/v1.18.0...v1.19.0) (2026-10-20)

### Features

- one coach per site, validated against the allowed-origin list ([#39](https://github.com/gerencserjani/coach-calendar/issues/39)) ([e207b83](https://github.com/gerencserjani/coach-calendar/commit/e207b83006baa00c32af3cdedd51ac1808dbf3b7)), closes [#32](https://github.com/gerencserjani/coach-calendar/issues/32)

# [1.18.0](https://github.com/gerencserjani/coach-calendar/compare/v1.17.0...v1.18.0) (2026-10-20)

### Features

- invite-based coach onboarding, created atomically on accept ([#38](https://github.com/gerencserjani/coach-calendar/issues/38)) ([87b9367](https://github.com/gerencserjani/coach-calendar/commit/87b9367041637c742ae5cc424c9ecca3dd3a2e4b)), closes [#32](https://github.com/gerencserjani/coach-calendar/issues/32)

# [1.17.0](https://github.com/gerencserjani/coach-calendar/compare/v1.16.0...v1.17.0) (2026-10-20)

### Features

- stamp bookings with their creating request's origin, drop FRONTEND_URL (refs [#32](https://github.com/gerencserjani/coach-calendar/issues/32)) ([83bc122](https://github.com/gerencserjani/coach-calendar/commit/83bc1226675b2cec3b335c3ec3b29636e2cc204e))

# [1.16.0](https://github.com/gerencserjani/coach-calendar/compare/v1.15.0...v1.16.0) (2026-10-20)

### Features

- store CORS allowed origins in DB, manageable from coach-admin (refs [#35](https://github.com/gerencserjani/coach-calendar/issues/35)) ([030d0f1](https://github.com/gerencserjani/coach-calendar/commit/030d0f1bd10ee25d1afb963ff76196ed833fb946))

# [1.15.0](https://github.com/gerencserjani/coach-calendar/compare/v1.14.0...v1.15.0) (2026-10-20)

### Bug Fixes

- restore missing Logger in BookingsService (merge main) ([c01e308](https://github.com/gerencserjani/coach-calendar/commit/c01e308adc05b993ebcd8df015996d8c450e52c7)), closes [#5](https://github.com/gerencserjani/coach-calendar/issues/5) [#30](https://github.com/gerencserjani/coach-calendar/issues/30) [#5](https://github.com/gerencserjani/coach-calendar/issues/5)

### Features

- add self-service password change for coaches (refs [#31](https://github.com/gerencserjani/coach-calendar/issues/31)) ([98d74a0](https://github.com/gerencserjani/coach-calendar/commit/98d74a0acb77d1df67eb909cc82b3ce508bd0de9))

# [1.14.0](https://github.com/gerencserjani/coach-calendar/compare/v1.13.0...v1.14.0) (2026-10-20)

### Bug Fixes

- scope authenticated coach-data endpoints by coachId (refs [#27](https://github.com/gerencserjani/coach-calendar/issues/27)) ([cc75e27](https://github.com/gerencserjani/coach-calendar/commit/cc75e27af7105b4d2256cfa13d87245a174d74c2))
- update stale enqueue() call sites for the current 3-arg signature ([cbca602](https://github.com/gerencserjani/coach-calendar/commit/cbca6021d0ad335c689117c5cd297827018fd0fc)), closes [pre-#17](https://github.com/pre-/issues/17)

### Features

- add structured logging across remaining backend services (refs [#28](https://github.com/gerencserjani/coach-calendar/issues/28)) ([b16d855](https://github.com/gerencserjani/coach-calendar/commit/b16d8555522f064ac73ea59c72f5f6684e890f17))

# [1.13.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.12.0...v1.13.0) (2026-10-20)

### Features

- carry coachId on queued notification jobs for log observability ([46e09ea](https://github.com/gerencserjani/betti-coaching-calendar/commit/46e09ea2042c562608d6269d769b45d12db4512a))

# [1.12.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.11.0...v1.12.0) (2026-10-20)

### Features

- coachId-based resolution for the public, unauthenticated endpoints ([c8f47a0](https://github.com/gerencserjani/betti-coaching-calendar/commit/c8f47a0d9381956da803db05b8d272170fd6b358))

# [1.11.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.10.0...v1.11.0) (2026-10-19)

### Features

- make Google Calendar/Meet integration tenant-scoped ([0cca9b9](https://github.com/gerencserjani/betti-coaching-calendar/commit/0cca9b95050d43a6a701735e06f773c9b601d7eb)), closes [#2](https://github.com/gerencserjani/betti-coaching-calendar/issues/2)
- tenant-aware email sending via Resend, with a Gmail fallback ([85bd4be](https://github.com/gerencserjani/betti-coaching-calendar/commit/85bd4be846be2348f4ef7129342f13586fcf18a0)), closes [#13](https://github.com/gerencserjani/betti-coaching-calendar/issues/13)

# [1.10.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.9.0...v1.10.0) (2026-10-19)

### Features

- replace singleton Settings with per-tenant settings ([8b72fc9](https://github.com/gerencserjani/betti-coaching-calendar/commit/8b72fc9c20920aa6348185394dbf127950c3262e)), closes [#14](https://github.com/gerencserjani/betti-coaching-calendar/issues/14) [#2](https://github.com/gerencserjani/betti-coaching-calendar/issues/2) [#13](https://github.com/gerencserjani/betti-coaching-calendar/issues/13) [#14](https://github.com/gerencserjani/betti-coaching-calendar/issues/14) [#12](https://github.com/gerencserjani/betti-coaching-calendar/issues/12)

# [1.9.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.8.3...v1.9.0) (2026-10-19)

### Features

- introduce Tenant entity as the multi-tenant foundation ([da4ee0e](https://github.com/gerencserjani/betti-coaching-calendar/commit/da4ee0eedda19e250dc3fbb31e0a9be41c0d2637)), closes [#11](https://github.com/gerencserjani/betti-coaching-calendar/issues/11) [#12](https://github.com/gerencserjani/betti-coaching-calendar/issues/12) [#13](https://github.com/gerencserjani/betti-coaching-calendar/issues/13) [#14](https://github.com/gerencserjani/betti-coaching-calendar/issues/14) [#15](https://github.com/gerencserjani/betti-coaching-calendar/issues/15) [#16](https://github.com/gerencserjani/betti-coaching-calendar/issues/16) [#17](https://github.com/gerencserjani/betti-coaching-calendar/issues/17)

## [1.8.3](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.8.2...v1.8.3) (2026-10-14)

### Performance Improvements

- switch production to Neon's pooled connection, keep direct for migrations ([f6d97fd](https://github.com/gerencserjani/betti-coaching-calendar/commit/f6d97fde8dc00000e96c6c8d60c716fb2b4e5946))

## [1.8.2](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.8.1...v1.8.2) (2026-10-14)

### Bug Fixes

- replace stale hardcoded test dates with dynamically computed future dates ([9a4ccb9](https://github.com/gerencserjani/betti-coaching-calendar/commit/9a4ccb9f1d4c397403b833eb91ed9ff683d0e964))

## [1.8.1](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.8.0...v1.8.1) (2026-10-14)

### Performance Improvements

- cut Cloud Run cold-start latency (migration boot step, lazy email import, googleapis size) ([2429622](https://github.com/gerencserjani/betti-coaching-calendar/commit/24296227c9e947359ceff7bdda3a112205d980ea))

# [1.8.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.7.3...v1.8.0) (2026-10-14)

### Features

- add brand logo to transactional booking emails ([d1adcfb](https://github.com/gerencserjani/betti-coaching-calendar/commit/d1adcfb10c0e503b326d574a431f3e7308e7fe7b))

## [1.7.3](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.7.2...v1.7.3) (2026-09-18)

### Bug Fixes

- enable Nest shutdown hooks so pg-boss actually drains gracefully ([9e625b7](https://github.com/gerencserjani/betti-coaching-calendar/commit/9e625b79ef3d16cf5874eadb861b9cdc0c4792b0))

## [1.7.2](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.7.1...v1.7.2) (2026-09-18)

### Bug Fixes

- exclude the booking being rescheduled from its own slot conflicts ([d8ca445](https://github.com/gerencserjani/betti-coaching-calendar/commit/d8ca445b69504dabd6ce0f6a7409e0ae333c624d))

## [1.7.1](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.7.0...v1.7.1) (2026-09-18)

### Bug Fixes

- request the userinfo.email scope in the Google Calendar OAuth flow ([d7c79d4](https://github.com/gerencserjani/betti-coaching-calendar/commit/d7c79d4e1dc517633920b992e00160ab57d957dc))

# [1.7.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.6.3...v1.7.0) (2026-09-18)

### Bug Fixes

- also show the calendar-update reminder to the coach ([cd5c39b](https://github.com/gerencserjani/betti-coaching-calendar/commit/cd5c39b72a61978f962ee83b7cee5a15ae5bf0a7))
- exclude slots inside the notice window from availability ([da2af67](https://github.com/gerencserjani/betti-coaching-calendar/commit/da2af6729075e10831288b1cf3d34b57075edf34))
- localize every client-facing booking/slots error message ([6116169](https://github.com/gerencserjani/betti-coaching-calendar/commit/61161694b23263784505828ef609bfab6c54f83a))
- localize the notice-window rejection message ([be79c34](https://github.com/gerencserjani/betti-coaching-calendar/commit/be79c349bed2231b470fe962bf4b042eb69ca104))
- name the coach in the client's coach-cancelled email ([afbc8b1](https://github.com/gerencserjani/betti-coaching-calendar/commit/afbc8b13338fa6559c93022b77e3d594601d54cf))

### Features

- remind client to update calendar entry on reschedule ([a5a2b7e](https://github.com/gerencserjani/betti-coaching-calendar/commit/a5a2b7ebe752bdb51fff1350516e158dbe356aa3))
- replace manage-booking button with cancel/reschedule links, add job logging ([a0079b0](https://github.com/gerencserjani/betti-coaching-calendar/commit/a0079b068a9c688c70a77aa45ffa125dfdcc6c0e))

## [1.6.3](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.6.2...v1.6.3) (2026-09-18)

### Bug Fixes

- apply the same phone location fix to the .ics attachment ([a37a434](https://github.com/gerencserjani/betti-coaching-calendar/commit/a37a434da19fa0a3cdde6677987e2580fbe39bfb))

## [1.6.2](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.6.1...v1.6.2) (2026-09-18)

### Bug Fixes

- use a phone label, not the business address, in the calendar link for PHONE bookings ([3811ce9](https://github.com/gerencserjani/betti-coaching-calendar/commit/3811ce94b4d28680be311370825c4de83b44c47e))

## [1.6.1](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.6.0...v1.6.1) (2026-09-18)

### Bug Fixes

- repair broken Mermaid sequence diagram in README ([5c44557](https://github.com/gerencserjani/betti-coaching-calendar/commit/5c445578f24d6dc56036bdaef87b0388f6c04b86))

# [1.6.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.5.1...v1.6.0) (2026-09-18)

### Features

- durable, retrying booking-notification queue via pg-boss ([6cbc0f6](https://github.com/gerencserjani/betti-coaching-calendar/commit/6cbc0f6d47e722903de33b3e0240f2b40e02181e))

## [1.5.1](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.5.0...v1.5.1) (2026-09-17)

### Bug Fixes

- close audit findings across auth, bookings, availability, and slots ([4f5b83c](https://github.com/gerencserjani/betti-coaching-calendar/commit/4f5b83c798ae047e4d0be23376f02e1bda1c2951))

# [1.5.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.4.0...v1.5.0) (2026-09-17)

### Features

- add update endpoints for weekly availability and date overrides ([45b09e6](https://github.com/gerencserjani/betti-coaching-calendar/commit/45b09e6a12a49b2bfc22290a487be5d9656c2ed5))

# [1.4.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.3.0...v1.4.0) (2026-09-17)

### Features

- add permanent delete for event types with no bookings ([806af84](https://github.com/gerencserjani/betti-coaching-calendar/commit/806af84632d4598bd18c6027d02447df91603d2e))

# [1.3.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.2.0...v1.3.0) (2026-09-17)

### Features

- add price and display-position to event types ([f7a3bb8](https://github.com/gerencserjani/betti-coaching-calendar/commit/f7a3bb8c7785716ddab8eed406293fbb4b899cab))

# [1.2.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.1.0...v1.2.0) (2026-09-16)

### Features

- send email via Gmail SMTP instead of Resend ([215afc1](https://github.com/gerencserjani/betti-coaching-calendar/commit/215afc160899fd6756b5f0d8bca63036d1a7c190))

# [1.1.0](https://github.com/gerencserjani/betti-coaching-calendar/compare/v1.0.0...v1.1.0) (2026-09-16)

### Features

- add OpenAPI/Swagger docs at /docs and /docs-json ([413192b](https://github.com/gerencserjani/betti-coaching-calendar/commit/413192b28a2b945084466d4cc66b32a37fffba01))

# 1.0.0 (2026-09-16)

### Features

- implement calendar booking API with self-hosted auth and Cloud Run deployment ([cdb1451](https://github.com/gerencserjani/betti-coaching-calendar/commit/cdb14511337c0b75de1bff72441ce63127ec7ced))
