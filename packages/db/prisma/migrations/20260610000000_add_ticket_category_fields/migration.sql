-- Add TicketCategory fields: openingMode, formId, welcomeMessage, color, emoji, position
ALTER TABLE "ticket_categories" ADD COLUMN "opening_mode" TEXT NOT NULL DEFAULT 'BUTTON';
ALTER TABLE "ticket_categories" ADD COLUMN "form_id" TEXT;
ALTER TABLE "ticket_categories" ADD COLUMN "welcome_message" TEXT;
ALTER TABLE "ticket_categories" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#5865F2';
ALTER TABLE "ticket_categories" ADD COLUMN "emoji" TEXT;
ALTER TABLE "ticket_categories" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Add TicketSettings transcript format field
ALTER TABLE "ticket_settings" ADD COLUMN "transcript_format" TEXT NOT NULL DEFAULT 'HTML';
