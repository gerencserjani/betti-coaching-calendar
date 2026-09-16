/*
  Warnings:

  - You are about to drop the column `fronteggUserId` on the `Coach` table. All the data in the column will be lost.
  - Added the required column `passwordHash` to the `Coach` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Coach_fronteggUserId_key";

-- AlterTable
ALTER TABLE "Coach" DROP COLUMN "fronteggUserId",
ADD COLUMN     "passwordHash" TEXT NOT NULL;
