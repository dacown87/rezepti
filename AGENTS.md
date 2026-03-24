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
- Datenbank: `data/rezepti.sqlite` (Legacy)
- Datenbank: `data/rezepti-react.db` (React)
- Frontend: `frontend/` (React Source)
- Built Frontend: `public/` (Production build)
- Test Suite: `test/` (E2E tests)
- Docker Docs: `DOCKER_DEPLOYMENT.md`

## Verfügbare Commands

```bash
# Development
npm run dev              # Dev Server (tsx watch)
npm start                # Production
npm run dev:react        # React Dev Server (Vite)
npm run build:react      # React Production Build

# Testing
npm test                 # Run Tests (Vitest Backend)
npm run test:e2e         # E2E Tests
npm run test:docker      # Docker Tests
npm run test:performance # Performance Tests
cd frontend && npx vitest --run src/components/  # React Component Tests

# Docker Commands
npm run docker:dev        # Docker Dev starten
npm run docker:dev:build  # Docker Dev mit Rebuild
npm run docker:dev:logs   # Docker Dev Logs
npm run docker:prod       # Docker Production
npm run docker:prod:build # Docker Production mit Rebuild
npm run docker:prod:logs  # Docker Production Logs
npm run docker:legacy     # Docker Legacy Production
npm run docker:stop       # Alle Container stoppen
npm run docker:stats      # Container Resource Usage
npm run docker:shell      # Shell in Dev Container
npm run docker:health     # Health Check
npm run docker:backup     # Daten sichern
npm run docker:restore    # Daten wiederherstellen
```

## Bekannte Einschränkungen

- `better-sqlite3` ist host-spezifisch (nicht als Volume mounten)
- Manuell via Browser/health endpoint testen ODER npm test / npm run docker:test

## App Starten (Lokal)

```bash
# 1. React Frontend bauen (nicht dev:react - vermeidet Permission-Fehler mit .vite)
npm run build:react

# 2. Backend starten (served automatisch das built Frontend)
npm run dev
```

- Frontend läuft auf http://localhost:3000/
- Nicht `npm run dev:react` verwenden (Permissions-Fehler mit `.vite` Ordner)

## Neue Architektur (React Migration)

- **React Frontend**: Vite + TypeScript + Tailwind CSS
- **BYOK Support**: User können eigenen Groq Key verwenden (Fallback: Default Key)
- **Mobile Ready**: Interfaces für spätere Expo/React Native App
- **Polling API**: `/api/v1/extract/react` für React Frontend
- **Neue DB**: `data/rezepti-react.db` für React App
- **Test Suite**: Comprehensive E2E tests in `test/` (1000+ lines)

## Prioritäten (basierend auf Roadmap)

### ✅ COMPLETED - Phase 3 (React Migration)
1. **React Migration** - Modernes Frontend mit BYOK Support ✅ COMPLETED
2. **Import & Extraction** - Websites, YouTube, TikTok, Instagram ✅ (80%)
3. **Mobile Preparation** - Platform-Abstraktion für Android/iOS ✅ (Interfaces ready)
4. **Docker Deployment** - Multi-stage Build mit DNS/yt-dlp Fixes ✅ COMPLETED
5. **E2E Testing** - Comprehensive test suite (1000+ lines) ✅ COMPLETED
6. **Unit Tests** - 254+ unit tests for API, components, backend ✅ COMPLETED

### ⏳ CURRENT PRIORITIES
7. **Recipe Display** - UI mit Zutaten & Schritten (50%)
8. **User Features** - Login, Rating, Kommentare (0%)
9. **Shopping & Planning** - Einkaufsliste, Rezeptvorschläge (0%)

### Phase 3 & 3b Completion Summary
- **React Frontend**: Vite + TypeScript + Tailwind CSS ✅
- **BYOK Support**: Echte Groq API Validierung ✅
- **Polling API**: `/api/v1/extract/react` mit Job Persistence ✅
- **Docker Deployment**: Multi-stage Build mit DNS Fixes ✅
- **Database Migration**: Tools für Legacy → React DB (16+ Rezepte migriert) ✅
- **UI/UX Polish**: Toast Notifications, Skeleton Loaders ✅
- **E2E Testing**: Comprehensive test suite (1000+ lines) ✅
- **Docker Documentation**: DOCKER_DEPLOYMENT.md (500+ lines) ✅
- **Unit Tests**: 254+ tests (API 91, Components 107, Backend 56) ✅

**Multiple Agents Deployment erfolgreich abgeschlossen!** 🚀