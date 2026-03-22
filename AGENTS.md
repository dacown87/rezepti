# AGENTS.md

Diese Datei enthält Informationen für AI-Agenten, die in diesem Projekt arbeiten.

## Aktueller Agent

**Modell:** DeepSeek V3.2 (OpenRouter)  
**Small Model:** Step 3.5 Flash (Free)

## Über den Benutzer

- **Sprache:** Deutsch für Kommunikation
- **Präferenz:** Kurze, direkte Antworten
- **Arbeitsweise:** incremental, mit häufiger Validierung

## Projekt-Konventionen

### Code
- ES Modules throughout (`.js` Extensions in Imports)
- Deutsche Texte für User-Facing Content
- Englische Code-Kommentare
- Zod Schema Validierung (`RecipeDataSchema` in `types.ts`)
- Async/await für alle async Operationen
- Keine Barrel Exports

### Git
- Aktiver Branch: `ph/Test`
- Commits gehen NIE direkt auf `main`
- SSH Remote: `git@github.com:dacown87/rezepti.git`

### Wichtige Pfade
- Server: `src/index.ts`
- Pipeline: `src/pipeline.ts`
- Datenbank: `data/rezepti.sqlite`
- Frontend: `public/index.html`

## Verfügbare Commands

```bash
npm run dev          # Dev Server (tsx watch)
npm start            # Production
npm run dev:react    # React Dev Server (Vite)
npm run build:react  # React Production Build
npm test             # Run Tests (Vitest)

# Docker Commands
npm run docker:dev          # Docker Dev starten
npm run docker:dev:build    # Docker Dev mit Rebuild
npm run docker:dev:logs      # Docker Dev Logs
npm run docker:prod          # Docker Production
npm run docker:prod:build    # Docker Production mit Rebuild
npm run docker:prod:logs     # Docker Production Logs
npm run docker:legacy        # Docker Legacy Production
npm run docker:stop          # Alle Container stoppen
npm run docker:stats         # Container Resource Usage
npm run docker:shell         # Shell in Dev Container
npm run docker:health        # Health Check
npm run docker:backup        # Daten sichern
npm run docker:restore       # Daten wiederherstellen
```

## Bekannte Einschränkungen

- Kein Test-Suite vorhanden
- Manuell via Browser/health endpoint testen
- `better-sqlite3` ist host-spezifisch (nicht als Volume mounten)

## Neue Architektur (React Migration)

- **React Frontend**: Vite + TypeScript + Tailwind CSS
- **BYOK Support**: User können eigenen Groq Key verwenden (Fallback: Default Key)
- **Mobile Ready**: Interfaces für spätere Expo/React Native App
- **Polling API**: `/api/v1/extract/react` für React Frontend
- **Neue DB**: `data/rezepti-react.db` für React App

## Prioritäten (basierend auf Roadmap)

### ✅ COMPLETED - Phase 3 (React Migration)
1. **React Migration** - Modernes Frontend mit BYOK Support ✅ COMPLETED
2. **Import & Extraction** - Websites, YouTube, TikTok, Instagram ✅ (80%)
3. **Mobile Preparation** - Platform-Abstraktion für Android/iOS ✅ (Interfaces ready)

### ⏳ CURRENT PRIORITIES
4. **Recipe Display** - UI mit Zutaten & Schritten (50%)
5. **User Features** - Login, Rating, Kommentare (0%)
6. **Shopping & Planning** - Einkaufsliste, Rezeptvorschläge (0%)

### Phase 3 Completion Summary
- **React Frontend**: Vite + TypeScript + Tailwind CSS ✅
- **BYOK Support**: Echte Groq API Validierung ✅
- **Polling API**: `/api/v1/extract/react` mit Job Persistence ✅
- **Docker Deployment**: Multi-stage Build mit React App ✅
- **Database Migration**: Tools für Legacy → React DB (7 Rezepte migriert) ✅
- **UI/UX Polish**: Toast Notifications, Skeleton Loaders ✅
- **E2E Testing**: BBC Good Food Extraktion validiert ✅

**Multiple Agents Deployment erfolgreich abgeschlossen!**