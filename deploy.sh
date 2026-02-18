#!/bin/bash

# Abitur Cloud – Deployment Manager 🚀
# Version: 1.0.0

# Configuration
VPS_USER="root"
VPS_IP="89.116.24.185"
REMOTE_DIR="/var/www/abitur-cloud"

show_menu() {
    clear
    echo "╔═══════════════════════════════════════╗"
    echo "║   Abitur Cloud – Deploy Manager 🚀   ║"
    echo "╠═══════════════════════════════════════╣"
    echo "║  1) Deploy Web (VPS)                  ║"
    echo "║  2) Build iOS (Capacitor)             ║"
    echo "║  3) Build macOS (Electron)            ║"
    echo "║  4) Full Release (All Platforms)      ║"
    echo "║  5) Status Check                      ║"
    echo "║  0) Exit                              ║"
    echo "╚═══════════════════════════════════════╝"
    echo -n "Choose an option: "
}

deploy_web() {
    echo "🚀 Starting Web Deployment..."
    
    # 1. Build
    echo "📦 Building Next.js App..."
    npm run build:mobile
    
    if [ $? -ne 0 ]; then
        echo "❌ Build failed. Aborting."
        return
    fi

    # 2. Prepare Zip
    echo "📦 Zipping build files..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    ZIP_NAME="deploy_$TIMESTAMP.zip"
    zip -r $ZIP_NAME .next public package.json next.config.mjs next.config.ts .env.production
    
    # 3. Upload
    echo "⬆️ Uploading to VPS..."
    scp $ZIP_NAME $VPS_USER@$VPS_IP:$REMOTE_DIR/
    
    # 4. Remote Update
    echo "🔧 Updating VPS..."
    ssh $VPS_USER@$VPS_IP << EOF
        cd $REMOTE_DIR
        unzip -o $ZIP_NAME
        rm $ZIP_NAME
        npm install --production
        
        # Restart Application
        if command -v pm2 &> /dev/null; then
            pm2 restart abitur-cloud || pm2 start npm --name "abitur-cloud" -- start
        fi
EOF
    
    rm $ZIP_NAME
    echo "✅ Web Deployment Complete!"
    read -n 1 -s -r -p "Press any key to continue..."
}

build_ios() {
    echo "📱 Starting iOS Build..."
    npm run build:mobile && npx cap sync ios
    echo "✅ iOS Sync Complete. Open Xcode to build/archive."
    read -n 1 -s -r -p "Press any key to continue..."
}

build_macos() {
    echo "🍎 Starting macOS Build..."
    npm run dist
    echo "✅ macOS Build Complete. Check 'dist' folder."
    read -n 1 -s -r -p "Press any key to continue..."
}

status_check() {
    echo "🔍 Checking System Status..."
    echo "--- Local ---"
    npm -v && node -v
    echo "--- VPS ---"
    ssh $VPS_USER@$VPS_IP "pm2 status abitur-cloud && uptime"
    read -n 1 -s -r -p "Press any key to continue..."
}

while true; do
    show_menu
    read opt
    case $opt in
        1) deploy_web ;;
        2) build_ios ;;
        3) build_macos ;;
        4) deploy_web && build_ios && build_macos ;;
        5) status_check ;;
        0) exit 0 ;;
        *) echo "Invalid option" ;;
    esac
done
