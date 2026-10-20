-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "frontendUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Coach_frontendUrl_key" ON "Coach"("frontendUrl");

