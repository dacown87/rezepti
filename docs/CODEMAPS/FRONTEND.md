# Frontend Codemap

**Last Updated:** 2026-03-28

## Technology Stack

- **Framework:** React 18 with Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **State:** React hooks + Context (minimal)
- **Build Output:** `public/` (served by backend)

## Entry Point

**Location:** `frontend/src/main.tsx`

```typescript
// Mounts App to #root
// Loads index.html from public/
```

## App Routes

**Location:** `frontend/src/App.tsx`

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `RecipeList` | Main recipe list |
| `/extract` | `ExtractionPage` | URL input, extraction |
| `/settings` | `SettingsPage` | BYOK, app status |
| `/shopping` | `ShoppingPage` | Shopping list |
| `/planner` | `PlannerPage` | 7-day meal planner |
| `/scan` | `ScannerPage` | QR code scanner |
| `/recipe/:id` | `RecipeDetail` | Recipe detail view |
| `/recipe/:id/cook` | `CookMode` | Fullscreen cook mode |

## Components

### Layout

**Location:** `frontend/src/components/Layout.tsx`

- Navigation sidebar with icons
- Routes: Home, Extract, Planner, Shopping, Settings
- Toast notification system
- Responsive design (mobile-first)

### RecipeList

**Location:** `frontend/src/components/RecipeList.tsx`

- Grid/list view toggle (persisted in localStorage)
- Search/filter by ingredients
- Rating display (1-5 stars)
- Click to navigate to detail

### RecipeDetail

**Location:** `frontend/src/components/RecipeDetail.tsx`

- Full recipe display: name, emoji, tags, image
- Two-column layout: ingredients | steps
- Inline edit mode (click to edit fields)
- Serving size scaler (×0.5–×4)
- Rating & notes (Phase 3a)
- "Cook Mode" button
- Original recipe link
- Share via QR code

### ExtractionPage

**Location:** `frontend/src/components/ExtractionPage.tsx`

- URL input field
- Job creation → polling for status
- Progress display (stage, percentage)
- Result preview
- Redirect to recipe detail on success
- Error handling with retry

### CookMode

**Location:** `frontend/src/components/CookMode.tsx`

- Fullscreen recipe view
- Wake lock API (prevent screen sleep)
- Large text for easy reading
- Step-by-step navigation
- Exit button

### ShoppingPage

**Location:** `frontend/src/components/ShoppingPage.tsx`

- Multi-recipe aggregation
- Check-off items
- Clipboard export
- Clear checked/all buttons
- Add custom items

### PlannerPage

**Location:** `frontend/src/components/PlannerPage.tsx`

- 7-day week view
- Drag & drop recipes (dnd-kit)
- Assign recipes to days
- Clear week button

### ScannerPage

**Location:** `frontend/src/components/ScannerPage.tsx`

- QR code scanner (BarcodeDetector API)
- QR code generator (offline JSON)
- Scan recipe URLs to import

### SettingsPage

**Location:** `frontend/src/components/SettingsPage.tsx`

- BYOK key management (validate, store, remove)
- App status (DB health, recipe count)
- Changelog modal

### Shared Components

| Component | Purpose |
|-----------|---------|
| `Toast.tsx` | Toast notification UI |
| `ToastManager.tsx` | Toast state management |
| `SkeletonLoader.tsx` | Loading placeholder |
| `ChangelogModal.tsx` | Version changelog display |
| `ShareModal.tsx` | Share recipe dialog |

## Utility Functions

**Location:** `frontend/src/utils/`

- `scaling.ts` - Portion scaling utilities
  - `parseServingsNumber(servings)` - Parse "4 Portionen" → 4
  - `scaleIngredient(ingredient, factor)` - Scale quantity

## API Client

Frontend communicates with backend via REST API. See [Backend Codemap](BACKEND.md) for endpoints.

## Styling

Tailwind CSS with custom design tokens:
- Primary: Orange/amber theme
- Mobile-first responsive breakpoints
- Dark mode support via `dark:` classes

## Build

```bash
npm run build:react   # Production build → public/
npm run dev:react     # Dev server (Vite)
```

## PWA Support

- Service worker via Vite PWA plugin
- Installable on mobile home screen
- Offline capability for installed app
