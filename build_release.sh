#!/bin/bash

# Build & Package Script for Abitur Cloud
# Usage: ./build_release.sh

echo "🚀 Starting Build Process for Abitur Cloud..."

# 1. Build Next.js App (Static Export)
echo "📦 Building Next.js App..."
npm run build:mobile

# 2. Build for macOS (Electron)
echo "🍎 Building for macOS..."
npm run dist

# 3. Build for iOS (Capacitor)
echo "📱 Syncing and Opening iOS Build..."
npx cap sync ios

echo "✅ Build Process Complete!"
echo "👉 macOS Build: dist/mac-arm64/AbiturCloud_v0915.zip"
echo "👉 iOS: Xcode should be open. Archive and distribute from there."
