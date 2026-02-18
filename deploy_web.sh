#!/bin/bash

# Configuration
SERVER_USER="supabaseabi"
SERVER_IP="192.168.178.92"
REMOTE_DIR="~/abitur-cloud"

echo "🚀 Starting Deployment to $SERVER_IP..."

# 1. Sync Source Code (Rsync)
echo "📡 Syncing source code..."
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
  ./ $SERVER_USER@$SERVER_IP:$REMOTE_DIR

if [ $? -ne 0 ]; then
    echo "❌ Rsync failed."
    exit 1
fi

# 2. Remote Build & Restart
echo "🏗️  Building and Restarting on Server..."
ssh $SERVER_USER@$SERVER_IP "source ~/.zshrc; cd $REMOTE_DIR && npm install && npm run build && pm2 restart abitur-cloud"

if [ $? -ne 0 ]; then
    echo "❌ Remote build/restart failed."
    exit 1
fi

echo "✅ Deployment Complete!"
echo "   Abitur Cloud: https://abiturcloud.com"
echo "   Portfolio:    https://portfolio.abiturcloud.com (Untouched)"
