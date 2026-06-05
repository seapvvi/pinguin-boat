-- Add last_live_id to stream_notifications for live stream tracking
ALTER TABLE "stream_notifications" ADD COLUMN "last_live_id" TEXT;
