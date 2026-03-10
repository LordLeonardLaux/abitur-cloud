# CLAUDE.md - Abitur Cloud

## Projekt-Übersicht
Lernplattform für Abiturienten. Next.js 16 Web-App mit Capacitor (iOS) und Electron (macOS Desktop).

## KRITISCHE REGELN

### Datenbank: NICHT ANFASSEN
- **NIEMALS** direkte Datenbank-Operationen auf dem Server ausführen
- **KEINE** SQL-Migrations direkt auf der Produktions-DB laufen lassen
- **KEINE** Supabase Admin API Calls die Daten verändern
- Datenbank läuft auf Supabase - Änderungen NUR über die Supabase Studio UI oder nach expliziter Freigabe

### Server: Nur abiturcloud.com
- Auf dem Mac Mini (192.168.178.92) laufen MEHRERE Dienste
- **NUR** die Abitur Cloud Domain anfassen
- **NICHT** anfassen: portfolio.abiturcloud.com (separates Portfolio)
- **NICHT** anfassen: Studio-Subdomain (Supabase Dashboard)
- Bei Deployments: Nur `/var/www/abitur-cloud` Verzeichnis betroffen

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4, Framer Motion, Lucide Icons
- **Backend:** Supabase (Auth, DB, Storage)
- **AI:** Google Gemini API (Chat, Flashcards)
- **Mobile:** Capacitor 8 (iOS)
- **Desktop:** Electron 39 (macOS)
- **Notifications:** OneSignal
- **Deployment:** Mac Mini lokal, PM2 Process Manager

## Architektur-Pattern

### Schichten
```
Component → Hook → Service → Repository → Supabase
```

### Verzeichnisstruktur
- `src/app/` - Pages (App Router) + API Routes
- `src/components/` - UI-Komponenten (nach Feature gruppiert)
- `src/contexts/` - React Context (AuthContext)
- `src/hooks/` - Custom Hooks (useAuth, useFriends, useTaskHub...)
- `src/services/` - Business Logic (authService, friendService, xpService)
- `src/repositories/` - Datenzugriff (baseRepository mit supabaseFetch Wrapper)
- `src/lib/` - Utilities, Supabase Client, Types, Constants

### Konventionen
- Components: PascalCase (`AuthGuard.tsx`)
- Hooks: camelCase mit `use` Prefix (`useFriends.ts`)
- Services/Repos: camelCase (`authService.ts`)
- DB-Tabellen: snake_case (`user_subjects`)
- Client Components: `'use client'` Directive
- Klassen: Tailwind utility-first, `clsx` + `tailwind-merge` für Composition

### Auth-Flow
- Supabase Auth (Email + Password)
- JWT Tokens in localStorage
- `AuthGuard` schützt Routes
- Rollen: student, teacher, smartboard, admin
- `is_approved` Flag für Freischaltung

## Build Commands
- `npm run dev` - Dev Server starten
- `npm run build` - Production Build
- `npm run ios:sync` - Capacitor iOS Sync + Xcode öffnen
- `npm run dist` - macOS Electron Build (DMG/ZIP)
- `./deploy_web.sh` - Deploy auf Mac Mini via rsync + PM2

## Umgebungsvariablen
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase Projekt URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Öffentlicher Supabase Key
- `GEMINI_API_KEY` - Server-seitig für AI API Routes
- `NEXT_PUBLIC_GEMINI_API_KEY` - Client-seitig für native Apps
- `IS_STATIC_BUILD` - true für Capacitor/Electron Export

## Hinweise
- Keine Tests vorhanden (kein Jest/Vitest Setup)
- TypeScript Build-Errors werden in next.config.ts ignoriert
- Bilder: unoptimized (wegen Electron/Capacitor)
- Static Export Modus für Mobile Builds (trailing slashes aktiv)
