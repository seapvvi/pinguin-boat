-- AlterEnum
-- No changes to PollStatus enum needed

-- AlterTable: polls
ALTER TABLE "polls" ADD COLUMN "anonymous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "polls" ADD COLUMN "multi_choice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "polls" ADD COLUMN "ends_at" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "polls_status_ends_at_idx" ON "polls"("status", "ends_at");

-- AlterTable: poll_votes
ALTER TABLE "poll_votes" ALTER COLUMN "user_id" DROP NOT NULL;
DROP INDEX IF EXISTS "poll_votes_poll_id_user_id_key";
CREATE INDEX IF NOT EXISTS "poll_votes_poll_id_user_id_idx" ON "poll_votes"("poll_id", "user_id");
