CREATE TABLE IF NOT EXISTS "pending_popups" (
    "id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "message" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pending_popups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pending_popups_target_user_id_idx" ON "pending_popups" ("target_user_id");
CREATE INDEX IF NOT EXISTS "pending_popups_expires_at_idx" ON "pending_popups" ("expires_at");

