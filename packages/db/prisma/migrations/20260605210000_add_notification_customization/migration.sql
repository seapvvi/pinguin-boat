-- Add notification customization fields to stream_notifications
ALTER TABLE "stream_notifications" ADD COLUMN "custom_title" TEXT;
ALTER TABLE "stream_notifications" ADD COLUMN "custom_description" TEXT;
ALTER TABLE "stream_notifications" ADD COLUMN "custom_color" TEXT;
ALTER TABLE "stream_notifications" ADD COLUMN "custom_footer" TEXT;
ALTER TABLE "stream_notifications" ADD COLUMN "mention_role_id" TEXT;
ALTER TABLE "stream_notifications" ADD COLUMN "ping_everyone_on_live" BOOLEAN NOT NULL DEFAULT false;
