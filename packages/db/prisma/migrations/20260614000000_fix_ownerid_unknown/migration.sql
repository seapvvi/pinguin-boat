-- Replace existing 'unknown' owner_id values with NULL
UPDATE guilds SET owner_id = NULL WHERE owner_id = 'unknown';
