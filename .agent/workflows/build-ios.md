---
description: Build and Sync iOS App
---

Use this workflow to sync the latest web code to the iOS project.

1. Generate static build of the Next.js app
// turbo
```bash
npm run build:mobile
```

2. Sync the code to the iOS project
// turbo
```bash
npx cap sync ios
```

3. Open Xcode to build and run the app
// turbo
```bash
npx cap open ios
```
