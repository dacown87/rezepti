# Plan: Bildauswahl nach Foto-Import

**Datum:** 2026-04-12
**Branch:** main
**Status:** BEREIT ZUR UMSETZUNG (Eng Review: CLEAR)

## Problem

Wenn der Nutzer ein Foto importiert und ein Rezept extrahiert wird, erscheint der Bildauswahl-Screen (ImagePickerModal) nicht — obwohl er sollte. Die App springt direkt zum Erfolgsscreen.

**Root Cause:** `extract.tsx:184`
```ts
if (suggestions.length > 0 && recipeId) {
```
Die Bedingung ist nur erfüllt wenn Chefkoch Bilder liefert. Findet Chefkoch nichts (häufig bei Rezepten aus Fotos), ist `suggestions = []` → Bedingung false → Modal wird übersprungen.

## Gewünschtes Verhalten

Nach jedem Foto-Import:
1. Immer den Bildauswahl-Screen anzeigen
2. Bis zu 4 Chefkoch-Bildvorschläge anzeigen
3. Freie Bildersuche: Nutzer kann eigenen Suchbegriff eingeben

## Betroffene Dateien (3 Dateien)

```
src/routes/extraction.ts          — neuer GET /api/v1/images/search Endpoint
mobile/app/(tabs)/extract.tsx     — Modal-Trigger-Bedingung fixen
mobile/components/ImagePickerModal.tsx  — Suchfunktion + Leer-Zustand hinzufügen
```

## Umsetzungsschritte

### 1. Backend: Suchendpoint (`src/routes/extraction.ts`)

Neuen GET-Endpoint hinzufügen — wiederverwendet bestehende `searchRecipeImages()`:

```ts
app.get("/api/v1/images/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ images: [] });
  const images = await searchRecipeImages(q).catch(() => []);
  return c.json({ images });
});
```

### 2. Frontend: Modal-Trigger fixen (`extract.tsx`)

```ts
// Neu: mode zum Zeitpunkt des Submits merken
const submittedModeRef = useRef<Mode>('url');

// In handlePhotoSubmit: vor setIsLoading
submittedModeRef.current = 'photo';

// In handleUrlSubmit: vor setIsLoading
submittedModeRef.current = 'url';

// In reset():
submittedModeRef.current = 'url';

// Bedingung ändern (Zeile 184):
// ALT:
if (suggestions.length > 0 && recipeId) {
// NEU:
if (recipeId && (submittedModeRef.current === 'photo' || suggestions.length > 0)) {
```

### 3. Modal: Suchfunktion + Leer-Zustand (`ImagePickerModal.tsx`)

Neue States:
```ts
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<string[]>([]);
const [isSearching, setIsSearching] = useState(false);
const [searchError, setSearchError] = useState(false);
```

Neue Suchfunktion:
```ts
const handleSearch = async () => {
  if (!searchQuery.trim()) return;
  setIsSearching(true);
  setSearchError(false);
  try {
    const serverUrl = await getServerUrl();
    const res = await fetch(`${serverUrl}/api/v1/images/search?q=${encodeURIComponent(searchQuery.trim())}`);
    const data = await res.json();
    setSearchResults(data.images ?? []);
  } catch {
    setSearchError(true);
    setSearchResults([]);
  } finally {
    setIsSearching(false);
  }
};
```

UI-Änderungen:
- Suchtitel dynamisch: "Passendes Bild wählen" bleibt, Untertitel wird `"Von Chefkoch.de – oder eigene Suche unten"` / `"Suche nach einem Bild für dein Rezept"`
- Wenn `images.length === 0`: Hinweis "Keine Treffer gefunden — suche selbst nach einem Bild"
- TextInput + "Suchen"-Button unterhalb des Bilderrasters
- Suchergebnisse werden dem Raster hinzugefügt (ersetzt oder ergänzt initial `images`)
- Bei Suchfehler: "Suche fehlgeschlagen — bitte nochmal versuchen" anzeigen

## Offene Fragen / Designentscheidungen

- **Suchergebnisse ersetzen oder ergänzen?** Empfehlung: Ersetzen (sauberer UX). Nutzer sucht → sieht neue 4 Bilder.
- **Upload-Foto als erste Option anzeigen?** Aktuell: Upload-Foto wird serverseitig als Fallback-Cover gesetzt. Kann in einer Folge-Version als Bild-Option 0 im Modal erscheinen. Nicht in diesem Plan.

## Failure Modes & Mitigationen

| Szenario | Was passiert | Mitigation |
|----------|-------------|------------|
| Chefkoch-Timeout (>5s) | `imageSuggestions = []`, Modal zeigt Leer-Zustand + Suche | ✅ bestehend (AbortController) |
| `/api/v1/images/search` nicht erreichbar | `catch` → `searchError = true` → Fehlermeldung | ✅ neu |
| `PATCH /api/v1/recipes/:id` schlägt fehl | Rezept gespeichert, Cover-Update schlägt still fehl | ⚠️ bestehend (`.catch(() => {})`) |
| Foto > 500KB + Chefkoch leer | Kein Cover gesetzt, Modal zeigt Leer-Zustand | ✅ Nutzer kann suchen |

## Tests

Minimum: Unit-Test für `GET /api/v1/images/search` (kein Server nötig, fetch mocken):
- `?q=Bolognese` → gibt 0–4 URLs zurück
- `?q=` (leer) → gibt `{ images: [] }` zurück
- Chefkoch-Timeout → gibt `{ images: [] }` zurück

E2E (optional, höchste Priorität):
- Foto-Import → extraction → Modal erscheint → Bild wählen → Erfolg
- Foto-Import → extraction → Modal erscheint → Überspringen → Erfolg

## Zeitschätzung

~30 Minuten mit CC.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 3 issues, 1 critical gap — alle adressiert |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** ENG CLEARED — bereit zur Umsetzung.
