-- Create RankCardSettings table
CREATE TABLE "rank_card_settings" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "background_type" TEXT NOT NULL DEFAULT 'COLOR',
    "background_color" TEXT NOT NULL DEFAULT '#23272a',
    "background_image" TEXT,
    "gradient_from" TEXT NOT NULL DEFAULT '#23272a',
    "gradient_to" TEXT NOT NULL DEFAULT '#2c2f33',
    "xp_bar_color" TEXT NOT NULL DEFAULT '#5865f2',
    "xp_bar_background" TEXT NOT NULL DEFAULT '#4f545c',
    "text_color" TEXT NOT NULL DEFAULT '#ffffff',
    "avatar_border" BOOLEAN NOT NULL DEFAULT true,
    "avatar_border_color" TEXT NOT NULL DEFAULT '#5865f2',
    "font_family" TEXT NOT NULL DEFAULT 'Sans-serif',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rank_card_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rank_card_settings_guild_id_key" UNIQUE ("guild_id")
);

-- Add foreign key for rank_card_settings
ALTER TABLE "rank_card_settings" ADD CONSTRAINT "rank_card_settings_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add xpMultiplier column to xp_role_rewards
ALTER TABLE "xp_role_rewards" ADD COLUMN "xp_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
