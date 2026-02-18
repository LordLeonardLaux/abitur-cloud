---
description: Build and Package macOS App
---

Use this workflow to build, package, and zip the macOS Electron application.

1. Clean previous builds (optional but recommended)
```bash
rm -rf dist dist-electron out
```

2. Build and Package the Application
// turbo
```bash
npm run dist
```

> [!NOTE]
> This command will:
> 1. Build the Next.js app as a static export.
> 2. Compile the Electron source code.
> 3. Use Electron-Builder to package the `.app` and `.dmg`.
> 4. Create a zip archive on your Desktop (`AbiturCloud_v0915.zip`).
