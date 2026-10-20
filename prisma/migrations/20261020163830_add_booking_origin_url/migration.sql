-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "originUrl" TEXT;

-- Backfill existing bookings with the one frontend origin that was true
-- for all of them at the time (the soon-to-be-removed global FRONTEND_URL)
-- -- new bookings get this captured live from their own creating request
-- instead (see BookingsService.create()).
UPDATE "Booking" SET "originUrl" = 'https://betti-coaching.vercel.app' WHERE "originUrl" IS NULL;
