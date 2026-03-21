-- AlterTable: make campaigns.sellpage_id nullable for sellpage deletion
ALTER TABLE "campaigns" ALTER COLUMN "sellpage_id" DROP NOT NULL;

-- Drop old FK (no onDelete rule)
ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_sellpage_id_fkey";

-- Re-create FK with onDelete: SetNull
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sellpage_id_fkey"
  FOREIGN KEY ("sellpage_id") REFERENCES "sellpages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
