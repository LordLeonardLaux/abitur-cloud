#!/bin/bash

# Abitur Cloud – Database Update Tool 🚀
VPS_USER="root"
VPS_IP="89.116.24.185"
LOCAL_SQL="migrations/xp_rank_system.sql"
REMOTE_SQL="/tmp/xp_rank_system.sql"

echo "⬆️ Lade SQL-Migration auf den Server hoch..."
scp $LOCAL_SQL $VPS_USER@$VPS_IP:$REMOTE_SQL

if [ $? -ne 0 ]; then
    echo "❌ Fehler beim Hochladen. Abbruch."
    exit 1
fi

echo "🔧 Führe SQL-Migration auf der Datenbank aus..."
ssh $VPS_USER@$VPS_IP "docker exec -i supabase-db psql -U postgres -d postgres < $REMOTE_SQL"

if [ $? -ne 0 ]; then
    echo "❌ Fehler bei der Ausführung des SQL-Scripts."
    exit 1
fi

echo "✅ Datenbank erfolgreich aktualisiert! Die XP-Spalten existieren nun."
