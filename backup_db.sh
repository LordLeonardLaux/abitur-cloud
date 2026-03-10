qw#!/bin/bash

# Configuration
BACKUP_DIR="$HOME/abitur-cloud-backups"
DB_URL="[HIER_DEINE_DB_URL_EINTRAGEN]"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/abiturcloud_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starte Backup: $BACKUP_FILE"

# Run pg_dump
# If pg_dump is not installed on the Mac natively, we might need to run it via docker
# but assuming standard postgresql client is installed:
pg_dump "$DB_URL" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup erfolgreich generiert!"
else
    echo "❌ Fehler beim Erstellen des Backups!"
    exit 1
fi

# Cleanup: Keep only the 2 newest files
echo "⚙️  Bereinige alte Backups (behalte nur die letzten 2)..."
cd "$BACKUP_DIR" || exit
# ls -t sorts by time. tail -n +3 skips the first 2 lines (the newest 2 files). 
# xargs rm deletes the rest.
ls -t | tail -n +3 | xargs -I {} rm -- {}

echo "✅ Bereinigung abgeschlossen. Aktuelle Backups:"
ls -lh
