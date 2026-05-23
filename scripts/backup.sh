#!/bin/bash
# Script de backup Pinguin BOAT

set -euo pipefail

BACKUP_PATH="/opt/pinguinboat/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_PATH/pinguinboat-backup-$TIMESTAMP.sql"

echo "💾 Backup Pinguin BOAT - $TIMESTAMP"

pg_dump -U pinguin -h localhost pinguinboat > "$BACKUP_FILE"
gzip "$BACKUP_FILE"

echo "✅ Backup créé : $BACKUP_FILE.gz"

# Keep only last 30 days
find "$BACKUP_PATH" -name "*.sql.gz" -mtime +30 -delete
