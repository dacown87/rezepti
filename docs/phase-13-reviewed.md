# Phase 13 — Import-Qualität (Reviewed 2026-04-29)

> Reviewed via /autoplan: CEO + Design + Eng + DX Review. Alle kritischen Gaps adressiert.

## Entscheidungen aus dem Review (User, 2026-04-29)

| Entscheidung | Wahl |
|-------------|------|
| 13j Reihenfolge | ZUERST in Welle 4 (Plugin-Architektur als Fundament) |
| parsedIngredients (13d) | Ephemer — nur im API-Response, keine DB-Spalte |
| Wave 4 (13h + 13j) | Bleibt in Phase 13 |
| Sample-Test vor 13a | JA — 20 URLs testen, Failures kategorisieren |

## Kritische Fixes aus dem Review (auto-decided)

- **ReDoS-Schutz 13e:** `html.slice(0, 100_000)` vor Regex-Matching
- **DOM-Block-Cap 13h:** max 10 Blöcke (Kostenschutz)
- **Warning dismissible (13f):** kleines X zum Schließen
- **amount: number (13d):** kein Range-Type — Ranges via `note`-Feld
- **nutritionEstimated:** API-Response-Feld, nicht DB-Schema

---

## Implementierungsreihenfolge (final)

### Vorarbeit — Sample-Test

20 URLs durch aktuelle Pipeline laufen lassen, Failures kategorisieren:
- JSON-LD fehlend → belegt ROI von 13b / 13e
- CSS kein Match → belegt ROI von 13a
- Timeout → Infrastruktur-Problem

```bash
# Script: 20 diverse URLs testen und Failure-Typ loggen
```

---

### Welle 1 — Sofort-Wins (je ≤2h)

**13a — CSS-Selektoren erweitern**
- Datei: `src/fetchers/web.ts` → `extractMainText()`, Z.61-74
- 20+ Klassen aus RecipeClipper: `o-Ingredients`, `o-Method`, `recipe-directions__list`, `steps-area`, `recipe-method-section`, `recipe__list--steps`, `recipesteps`, `recipe-steps`, `instructionlist`, `instruction-list`, `directionlist`, `direction-list`, `preparationsteps`, `preparation-steps`, `prepsteps`, `prep-steps`, `recipeinstructions`, `recipe-instructions`, `recipemethod`, `recipe-method`, `directions`, `instructions`

**13c — Bessere Fehlermeldungen**
- Datei: `src/pipeline.ts` → `toUserFriendlyError()`, Z.246-309
- Neu: Web ohne Schema, YouTube ohne Untertitel, TikTok privat, Timeout mit konkreten Sekunden

**13f — Scraper-Validierung**
- Dateien: `src/pipeline.ts` Z.95-100, `src/job-manager.ts`
- Warning-Flag wenn: `ingredients.length === 0`, `steps.length === 0`, Name = URL-Fragment
- Frontend: gelber dismissibler Badge (X-Button)

---

### Welle 2 — Schema-Erweiterungen (je 2-4h)

**13b — Microdata-Support**
- Datei: `src/fetchers/web.ts` — neue Funktion `extractMicrodataRecipe(html)`
- `$('[itemtype*="schema.org/Recipe"]')` → itemprop-Felder auslesen
- Integration: nach JSON-LD, vor Text-Fallback
- Tests: `test/unit/schema-org.test.ts` — Microdata-Fixtures

**13e — Wild-Mode**
- Datei: `src/fetchers/web.ts` — neue Funktion `extractJsonLdWild(html)`
- Strategie: script-Tags ohne korrekten type + `window.__NUXT__/__NEXT_DATA__` + Regex
- **ReDoS-Schutz:** `html.slice(0, 100_000)` vor Regex
- Aufruf: Stufe 3 nach JSON-LD + Microdata, vor CSS-Fallback
- Tests: `test/unit/web.test.ts` (neu) — Wild-Mode Fixtures

---

### Welle 3 — Neue Features (je 3-6h)

**13g — Rezept als Freitext**
- Backend: `POST /api/v1/extract/text` → `{ text: string }` → `extractRecipeFromText()` → DB-Save
- Client-Validation: min 50 Zeichen, sonst 400 `{ error: "Text zu kurz (min. 50 Zeichen)" }`
- Frontend: `extract.tsx` — dritter Mode `'text'`, Icon `Type` (lucide), Tab-Reihenfolge: URL > Text > Foto
- Textarea: `multiline`, min 6 Zeilen
- CLAUDE.md API-Tabelle ergänzen

**13d — Ingredient-Parser**
- Neue Datei: `src/processors/ingredient-parser.ts`
- `parseIngredient(raw: string): ParsedIngredient`
- `amount?: number` (kein Range — Ranges → `note`)
- Einheiten-Liste: g, kg, ml, l, EL, TL, Stück, Prise, Bund, Dose, Pkg., ...
- **Ephemer:** kein DB-Feld, nur im API-Response + ephemer in schemaToRecipeData()
- **Koordination mit `scaling.ts`:** kein Duplikat von `parseServingsNumber()`
- Tests: `test/unit/ingredient-parser.test.ts` (~20 Cases, deutsch, Bruchzahlen, Unicode)

**13i — Nutrition-Auto-Detection**
- Datei: `src/pipeline.ts` — nach `finalizeRecipe()` / `refineRecipe()`
- Trigger: `recipe.calories` leer nach Extraktion
- LLM-Prompt: `"Schätze Nährwerte pro Portion: {Zutaten}. Antworte nur mit JSON: {calories, protein, fat, carbs}"`
- API-Response: `nutritionEstimated: true` (kein DB-Feld)
- Frontend: `~` vor geschätzten Werten (z.B. `~320 kcal`)

---

### Welle 4 — Komplexe Features (je ≥8h)

**13j — Domain-spezifische Scraper-Module** ← ZUERST
- `src/fetchers/web/base.ts` — abstrakte Klasse
- `src/fetchers/web/chefkoch.ts` — Domain-Override
- `src/fetchers/web/index.ts` — Domain-Mapping
- `src/fetchers/web.ts` → schlanker Dispatcher
- Vor Merge: `grep -r "from.*fetchers/web" src/` — alle Import-Pfade prüfen

**13h — ML-Fallback für Web-Scraping** ← NACH 13j
- Erst nach 13j in Plugin-Architektur integrieren
- **DOM-Block-Cap: max 10 Blöcke** (Kostenschutz)
- Feature-Flag: `ENABLE_ML_FALLBACK=true` in `.env`
- Trigger: nur wenn extractMainText() Body-Fallback produziert (kein Selektor traf)

---

## Kritische Dateien

| Datei | Items |
|-------|-------|
| `src/fetchers/web.ts` | 13a, 13b, 13e, 13h, 13j |
| `src/pipeline.ts` | 13c, 13f, 13i |
| `src/processors/ingredient-parser.ts` | 13d (neu) |
| `src/processors/schema-org.ts` | 13d (Integration) |
| `src/job-manager.ts` | 13f (Warning-Feld) |
| `src/api-react.ts` | 13g (neuer Endpoint) |
| `mobile/app/(tabs)/extract.tsx` | 13g (Text-Mode) |
| `test/unit/schema-org.test.ts` | 13b (Microdata-Fixtures) |
| `test/unit/web.test.ts` | 13e (Wild-Mode, neu) |
| `test/unit/ingredient-parser.test.ts` | 13d (neu) |

## Verifikation

Nach jeder Welle:
1. `npx tsc --noEmit` — keine TS-Fehler
2. `npm test -- --run --exclude="test/e2e/**"` — alle Unit-Tests grün
3. Manuell: Food-Blog-URL → Zutaten erkannt? Fehlermeldung spezifisch?

## Failure Modes Registry

| Modus | Failure | Severity | Mitigation |
|-------|---------|----------|-----------|
| 13e Wild-Mode | ReDoS bei manipuliertem HTML | Hoch | Input-Cap 100k |
| 13h ML-Fallback | LLM-Kosten-Explosion | Mittel | Block-Cap max 10 |
| 13i Nutrition | Falsche Schätzung | Mittel | `estimated: true` zwingend |
| 13j Refactoring | Broken Imports | Hoch | grep vor Merge |
