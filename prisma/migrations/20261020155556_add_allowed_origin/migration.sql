-- CreateTable
CREATE TABLE "AllowedOrigin" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowedOrigin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedOrigin_origin_key" ON "AllowedOrigin"("origin");

-- Seed the current production frontend's origin (from FRONTEND_URL) so the
-- live site doesn't lose CORS access the moment this deploys -- see #35.
INSERT INTO "AllowedOrigin" ("id", "origin", "label")
VALUES ('seed-betti-coaching-frontend', 'https://betti-coaching.vercel.app', 'betti-coaching (seeded on migration)');
