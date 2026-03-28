---
status: COMPLETED
last_reviewed: 2026-03-28
feature: Chefkoch Verbesserung (40% → 100%)
priority: 1
phase: 9
branch: phase/9-chefkoch-verbesserung
completed: 2026-03-28
---

# Plan: Chefkoch Verbesserung

## Ziel

Chefkoch.de Rezepte zuverlässig importieren (40% → 100% Extraktionsrate).

## Problem

- Chefkoch wird als generische "web"-Kategorie behandelt
- Schema.org nur teilweise funktionierend (40%)
- Keine spezielle Handhabung für deutsche Portionsangaben
- Kein Fallback für fehlende Schema.org-Daten

---

## Aktuelle Situation

**Klassifizierung:** `chefkoch.de/rezepte/...` → `type: "web"` (Fallback)

**Pipeline:** Web-Fetcher → Schema.org Parser → LLM-Fallback

**Bekannte Lücken:**
- `recipeYield`: "für 4 Personen", "ca. 6 Stück" → nicht normalisiert
- Schema.org: teilweise vorhanden, teilweise fehlend
- HTML-Fallback: keine chefkoch-spezifischen Selektoren

---

## Implementierungs-Phasen

### Phase 1: Analyse (Tag 1)

1. **Chefkoch.de Schema.org-Struktur analysieren**
   - JSON-LD Format dokumentieren
   - Lücken identifizieren

2. **Portionsangaben-Format analysieren**
   - Beispiele sammeln: "für 4 Personen", "ca. 6 Stück"

3. **HTML-Fallback-Struktur identifizieren**
   - CSS-Klassen: `.recipe-ingredients`, `.recipe-steps`

### Phase 2: Chefkoch-Kategorie einführen (Tag 2)

1. **`src/classifier.ts` erweitern**
   ```typescript
   ["chefkoch", /(?:www\.)?chefkoch\.de\/rezepte\//i],
   ```

2. **`src/types.ts` erweitern**
   - `SourceType` um "chefkoch" ergänzen

3. **`src/pipeline.ts` erweitern**
   - `case "chefkoch":` mit neuem Fetcher

### Phase 3: Chefkoch-spezifischer Fetcher (Tag 3)

1. **`src/fetchers/chefkoch.ts` erstellen**
   - Schema.org Parser mit Chefkoch-Anpassungen
   - Portions-Parsing für deutsche Formate
   - HTML-Fallback

2. **Portions-Parsing:**
   ```typescript
   function parseChefkochServings(yieldText: string): string {
     // "für 4 Personen" → "4"
     // "ca. 6 Stück" → "6"
     // Fallback: original
   }
   ```

### Phase 4: Testing & Integration (Tag 4)

1. Unit Tests für Parser
2. E2E Test mit realer Chefkoch-URL
3. Performance-Check

---

## Risiko-Analyse

| Risiko | Level | Mitigation |
|--------|-------|------------|
| Schema.org Formatänderung | MEDIUM | Fallback-HTML-Selektoren |
| HTML-Klassen ändern sich | MEDIUM | Robuste Selektoren |
| Rate Limits | LOW | Einhalten der robots.txt |

---

## Erfolgskriterien

- [ ] Chefkoch URLs werden als "chefkoch" klassifiziert
- [ ] Extraktionsrate 40% → 90%+
- [ ] Portionsangaben korrekt geparst
- [ ] Unit Tests bestanden
- [ ] Keine Performance-Regression

---

## Abhängigkeiten

- Externe: Chefkoch.de (HTML, Schema.org)
- Interne: `src/fetchers/web.ts`, `src/processors/schema-org.ts`

---

## Geschätzter Aufwand

**2-4 Stunden** (1-2 Sessions)

---

## Verwandte Dateien

| Datei | Änderung |
|-------|----------|
| `src/classifier.ts` | Pattern hinzufügen |
| `src/types.ts` | SourceType erweitern |
| `src/pipeline.ts` | case "chefkoch" |
| `src/fetchers/chefkoch.ts` | **NEU** |
| `docs/superpowers/plans/2026-03-28-chefkoch-verbesserung.md` | Dieser Plan |

---

## Fortschritt

- [x] Phase 1: Analyse
- [x] Phase 2: Kategorie einführen
- [x] Phase 3: Fetcher erstellen
- [x] Phase 4: Testing

---

## Offene Fragen

1. Welche konkreten Chefkoch-URLs funktionieren aktuell nicht?
2. Gibt es besondere Zutaten-Formatierungen die zu beachten sind?
3. Soll der Fetcher auch Cookidoo-Credentials unterstützen?
