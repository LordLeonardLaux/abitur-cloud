#!/bin/bash

# Abitur Cloud Mac Mini "Rüberzieh"-Skript
# Synchronisiert Dateien lokal zum Mac Mini und startet dort den Build & PM2 neu.
# DIE DATENBANK WIRD HIERBEI 100% IN RUHE GELASSEN!

set -e

echo "🚀 Starte das Web-Update für den Mac Mini (192.168.178.92)..."

echo "1️⃣ Kopiere Dateien via rsync (überspringt node_modules, .git etc.)..."
rsync -avz --delete \
  --exclude '.git' \
  --exclude '.next' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'dist-electron' \
  --exclude 'ios' \
  --exclude 'android' \
  --exclude '.DS_Store' \
  --exclude '.env.local' \
  --exclude 'abitur-cloud-update.zip' \
  ./ supabaseabi@192.168.178.92:~/abitur-cloud

echo "2️⃣ Starte Build und PM2 Restart direkt auf dem Mac Mini..."
# Try multiple common locations for npm/node (nvm, Homebrew, fnm, system)
ssh supabaseabi@192.168.178.92 'export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; cd ~/abitur-cloud && npm install --production=false && npm run build && pm2 restart abitur-cloud'

if [ $? -ne 0 ]; then
    echo "❌ Fehler beim Build oder PM2 Restart auf dem Mac Mini!"
    exit 1
fi

echo "✅ Das Update wurde erfolgreich auf den Mac Mini hochgeladen und neugestartet!"

