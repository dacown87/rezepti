# Frontend Codemap

**Last Updated:** 2026-04-02

## Technology Stack

- **Framework:** React Native (Expo) — Web + Android/iOS
- **Language:** TypeScript
- **Styling:** Tailwind CSS (NativeWind für native), StyleSheet für native
- **Routing:** Expo Router
- **State:** React hooks + AsyncStorage (persisted state)
- **Build:** Expo Web (static output → `public/`, served by backend)
- **Native Builds:** EAS Build (`eas.json`)

## Entry Point

**Location:** `frontend/src/` (Expo app)

## App Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `RecipeList` | Main recipe list |
| `/extract` | `ExtractionPage` | URL input, photo import, QR scanner |
| `/settings` | `SettingsPage` | BYOK, app status, Cookidoo |
| `/shopping` | `ShoppingPage` | Shopping list |
| `/planner` | `PlannerPage` | 7-day meal planner with QR import |
| `/recipe/:id` | `RecipeDetail` | Recipe detail view |
| `/recipe/:id/cook` | `CookMode` | Fullscreen cook mode |

## Components

### Layout

**Location:** `frontend/src/components/Layout.tsx`

- Navigation sidebar with icons
- Routes: Home, Extract, Shopping, Planner, Settings
- Toast notification system
- Responsive design (mobile-first)
- RecipeDeck logo (Logo.svg)

### RecipeList

**Location:** `frontend/src/components/RecipeList.tsx`

- Grid/list view toggle (persisted in AsyncStorage/localStorage)
- Search/filter by ingredients
- Rating display (1-5 stars)
- PDF multi-export button

### RecipeDetail

**Location:** `frontend/src/components/RecipeDetail.tsx`

- Full recipe display: name, emoji, tags, image
- Two-column layout: ingredients | steps
- Inline edit mode
- Serving size scaler (×0.5–×4)
- Rating & notes
- Cook Mode button, Share via QR, PDF export
- Original recipe link

### ExtractionPage

**Location:** `frontend/src/components/ExtractionPage.tsx`

- Tabs: **URL** / **Kamera** / **Datei** / **QR-Code**
- Job creation → polling for status
- Progress display (stage, percentage)
- Error handling with retry
- QR scanning via BarcodeDetector API (Chromium only; native: expo-barcode-scanner)

### CookMode

**Location:** `frontend/src/components/CookMode.tsx`

- Fullscreen recipe view, Wake Lock API
- Step-by-step navigation

### ShoppingPage

**Location:** `frontend/src/components/ShoppingPage.tsx`

- Multi-recipe aggregation
- Check-off items, clipboard export
- Add custom items

### PlannerPage

**Location:** `frontend/src/components/PlannerPage.tsx`

- 7-day week view
- Drag & drop (dnd-kit, web only)
- Add-Modal mit Tabs: **Rezept** / **Kamera** (QR-Scan)
- `scanningRef = useRef(false)` für Kamera-Loop-Kontrolle (kein stale closure)

### SettingsPage

**Location:** `frontend/src/components/SettingsPage.tsx`

- BYOK key management
- App status (DB health, recipe count)
- Cookidoo credentials
- Changelog modal

### Shared Components

| Component | Purpose |
|-----------|---------|
| `Toast.tsx` | Toast notification UI |
| `ToastManager.tsx` | Toast state management |
| `SkeletonLoader.tsx` | Loading placeholder |
| `ChangelogModal.tsx` | Version changelog display |
| `ShareModal.tsx` | Share recipe dialog |
| `PDFSelectionModal.tsx` | PDF export selection |

## Utility Functions

**Location:** `frontend/src/utils/`

| File | Purpose |
|------|---------|
| `scaling.ts` | Portion scaling: `parseServingsNumber`, `scaleIngredient` |
| `pdf-export.ts` | jsPDF export with QR code + image via backend proxy |
| `recipe-qr.ts` | QR encode/decode (compact JSON, 2 KB limit) |

## API Client

**Location:** `frontend/src/api/services.ts`

REST calls to backend `/api/v1/*`. Uses `getServerUrl()` for same-origin on web, configured URL on native.

## Build

```bash
npm run build:react   # Expo Web → public/ (served by backend)
npm run dev:react     # Expo Dev Server
```

## EAS / Native Builds

```bash
eas build --platform android   # Android APK/AAB via EAS
eas build --platform ios       # iOS (requires Apple Developer Account)
```

Config: `app.json`, `eas.json` — EAS Project ID: `19e500e1-c382-4087-b510-2a07221806e3`

## PWA Support

- Service worker via Expo Web
- Installable on mobile home screen
- Offline capability for installed app

## Known Limitations

- **BarcodeDetector API:** Chromium only (Chrome/Edge) — Safari/Firefox not supported. For native builds: use `expo-barcode-scanner`.
- **Drag & Drop:** `dnd-kit` is web-only; native equivalent needed if DnD is required on Android/iOS.
