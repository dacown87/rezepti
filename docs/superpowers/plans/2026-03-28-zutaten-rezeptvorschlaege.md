---
status: PLANNING
last_reviewed: 2026-03-28
feature: Zutaten-basierte Rezeptvorschläge (0% → 100%)
priority: 2
phase: 10
branch: phase/10-zutaten-rezeptvorschlaege
---

# Plan: "Was habe ich zu Hause?" Rezeptvorschläge

## Ziel

Benutzer können verfügbare Zutaten eingeben → System findet passende Rezepte basierend auf AND-Logik und Match-Scoring.

---

## Aktuelle Situation

### Vorhandene Bausteine ✅
1. **Ingredient-Dictionary** (`src/ingredient-dictionary.ts`)
   - Levenshtein-Matching für ähnliche Namen
   - Unit-Erkennung (g, kg, ml, EL, TL, etc.)
   - `extractIngredientName()` für Name-Extraktion

2. **Datenbank:**
   - `ingredient_dictionary` Tabelle (canonical_name, aliases)
   - Rezepte mit `ingredients TEXT` (JSON-Array)

3. **API Endpoint:**
   - `GET /api/v1/recipes?ingredients=...` (OR-Logik, Substring-Match)

### Probleme ❌
1. **OR statt AND Logik:** Aktuelle Suche findet Rezepte mit **irgendeiner** passenden Zutat
2. **Kein Scoring:** Keine Relevanz-Berechnung (10/15 Zutaten = 66%)
3. **Performance:** Vollständiger Tabellenscan, keine Indizes
4. **Unnormalisierte Daten:** Zutaten als JSON-Array schwer zu durchsuchen
5. **Frontend fehlt:** Keine UI für "Was habe ich zu Hause?"

---

## Implementierungs-Phasen

### Phase 1: Verbesserung bestehender Suche (2 Tage)

**Backend:**
1. **FTS5-Index hinzufügen** für schnelle Textsuche in Zutaten
   ```sql
   CREATE VIRTUAL TABLE recipes_fts USING fts5(
     name, ingredients, tags,
     content='recipes',
     content_rowid='id'
   );
   ```

2. **API-Endpunkt erweitern** für AND-Logik:
   ```
   GET /api/v1/recipes?ingredients=tomaten,käse&match=and
   ```
   - `match=and|or` Parameter
   - Rückgabe mit `match_score` (0-100%)

3. **Dictionary-Integration** in Suche:
   - Zuerst normalisieren via `ingredient-dictionary.ts`
   - Dann Matching auf canonical names

### Phase 2: AND-Logik Engine (3 Tage)

**Matching-Algorithmus:**
1. **Zutaten-Parsing** für jedes Rezept:
   ```typescript
   parseIngredient("200g Mehl") → { name: "Mehl", normalized: "mehl" }
   ```

2. **Scoring-System:**
   ```typescript
   function calculateMatchScore(
     recipeIngredients: string[], 
     userIngredients: string[]
   ): number {
     // Beispiel: 10/15 Zutaten = 66.6%
     // Bonus für exakte Menge-Übereinstimmung
     // Penalty für fehlende Hauptzutaten
   }
   ```

3. **Optimierte Suche:**
   - SQLite FTS5 für Text-Matching
   - Memory-Cache für häufige Suchanfragen
   - Batch-Verarbeitung für viele Zutaten

### Phase 3: Frontend UI (2 Tage)

**Komponenten:**
1. **Zutaten-Eingabe:**
   - Multi-Input mit Auto-Vervollständigung
   - Toggle OR/AND Logik
   - "Meine Vorräte" persistieren in localStorage

2. **Ergebnis-Liste:**
   - Match-Prozent anzeigen (⚡ 85% Match)
   - Fehlende Zutaten hervorheben
   - Sortierung nach Relevanz

3. **Quick-Actions:**
   - "Was kann ich mit Tomaten, Zwiebeln, Käse kochen?"
   - "Hauptzutat: Hähnchen" + verfügbare Zutaten

### Phase 4: Normalisierung & Dictionary (3 Tage)

**Dictionary-Erweiterung:**
1. **Automatische Extraktion:**
   ```typescript
   // Alle Zutaten aus existierenden Rezepten in Dictionary
   async function populateDictionaryFromRecipes()
   ```

2. **Kategorien hinzufügen:**
   ```sql
   ALTER TABLE ingredient_dictionary ADD COLUMN category TEXT;
   -- Gemüse, Obst, Milchprodukte, Gewürze, etc.
   ```

3. **Normalisierungs-Pipeline:**
   ```typescript
   normalizeIngredient("2 Tomaten, geschnitten") → "tomaten"
   ```

### Phase 5: Erweiterte Features (Optional, 2 Tage)

1. **Substitutions-Vorschläge:**
   - "Hast du keinen Joghurt? → Sauerrahm geht auch"
   - Ersetzungsregeln im Dictionary

2. **Allergie-Filter:**
   - Gluten-frei, Laktose-frei, Nuss-Allergie
   - Filter in Suche integrieren

3. **Persistierte Profile:**
   - "Meine Standard-Vorräte"
   - "Meine Allergien/Abneigungen"

---

## Risiko-Analyse

| Risiko | Level | Mitigation |
|--------|-------|------------|
| Performance bei vielen Rezepten | MEDIUM | FTS5-Index, Caching |
| Matching-Genauigkeit | MEDIUM | Dictionary-basierte Normalisierung |
| Datenbank-Migration | LOW | Kompatibilitätslayer |
| UI/UX Komplexität | LOW | Progressive Enhancement |

---

## Erfolgskriterien

- [ ] AND-Logik funktioniert (alle Zutaten müssen passen)
- [ ] Match-Score 0-100% wird berechnet
- [ ] Suche <2s für 1000 Rezepte
- [ ] Frontend: Intuitive Zutaten-Eingabe
- [ ] "Meine Vorräte" persistieren
- [ ] Unit Tests für Matching-Algorithmus

---

## Datenbank-Änderungen

**Minimal:**
```sql
-- FTS5 Index für schnelle Suche
CREATE VIRTUAL TABLE recipes_fts USING fts5(...);

-- Dictionary erweitern
ALTER TABLE ingredient_dictionary ADD COLUMN category TEXT;
```

**Optional (Breaking Change):**
```sql
-- Normalisierte Zutaten-Tabelle
CREATE TABLE recipe_ingredients (
  recipe_id INTEGER REFERENCES recipes(id),
  canonical_name TEXT,
  quantity REAL,
  unit TEXT,
  normalized_name TEXT
);
```

---

## API-Änderungen

**Erweiterter Endpunkt:**
```typescript
GET /api/v1/recipes?ingredients=tomaten,käse&match=and&threshold=70
// threshold: min. Match-Prozent (default: 0)
// match: and|or (default: or)

Response: {
  recipes: Recipe[],
  match_scores: number[], // [85, 73, 62]
  missing_ingredients: string[][] // pro Rezept
}
```

---

## Geschätzter Aufwand

**5-7 Tage** (reduziert von 10-12 Tagen)
*Änderung durch Planner-Review (2026-03-28): Simplerer Ansatz – API + Frontend statt vollständige FTS5-Migration*

- Phase 1: 1 Tag
- Phase 2: 2 Tage
- Phase 3: 1 Tag
- Phase 4: 1-2 Tage
- Phase 5: Optional

---

## Verwandte Dateien

| Datei | Änderung |
|-------|----------|
| `src/ingredient-dictionary.ts` | Erweiterung |
| `src/api-react.ts` | Neue Search-Parameter |
| `frontend/src/components/IngredientsSearch.tsx` | **NEU** |
| `src/db-react.ts` | FTS5 Index |
| `src/schema.ts` | Dictionary-Erweiterung |

---

## Abhängigkeiten

1. **Bestehende:** Ingredient-Dictionary, Recipe DB
2. **Frontend:** React, localStorage API
3. **Performance:** SQLite FTS5
4. **Testing:** Unit Tests für Matching-Algorithmus

---

## Offene Fragen

1. **Breaking Change?** Sollten wir zu normalisierter `recipe_ingredients` Tabelle migrieren?
2. **Scoring-Algorithmus:** Wie genau Match-Prozent berechnen?
3. **UI-Design:** Wie sieht die beste UX für Zutaten-Eingabe aus?
4. **Persistenz:** localStorage oder DB für "Meine Vorräte"?

---

## Fortschritt

- [ ] Phase 1: FTS5 + API-Erweiterung
- [ ] Phase 2: AND-Logik Engine  
- [ ] Phase 3: Frontend UI
- [ ] Phase 4: Dictionary-Erweiterung
- [ ] Phase 5: Erweiterte Features