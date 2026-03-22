-- AlterTable
ALTER TABLE "fb_connections" ADD COLUMN "token_expires_at" TIMESTAMPTZ;

-- CreateIndex (for the refresh cron to quickly find expiring tokens)
CREATE INDEX "fb_connections_token_expires_at_idx" ON "fb_connections" ("token_expires_at")
WHERE "token_expires_at" IS NOT NULL AND "is_active" = true;
