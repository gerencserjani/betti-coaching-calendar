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
