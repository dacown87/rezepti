# Cookidoo Schritt-Bereinigung — Learnings 2026-04-03

## Problem

Cookidoo bettet in den `recipeInstructions[].text` Feldern des JSON-LD **HTML-Tags und Private Use Area (PUA) Unicode-Zeichen** ein. Beides muss vor der Anzeige bereinigt werden.

## Was im JSON-LD steckt

- `<nobr>5 Sek./Stufe 6</nobr>` — HTML-Tags direkt im text-Feld
- U+E003 (PUA) — Cookidoo rendert das Linkslauf-Symbol via CSS/Font aus dem Private Use Area. Im JSON-LD text-Feld erscheint das Zeichen als roher Codepoint zwischen den Slashes: `2 Min./95°C/[U+E003]/Stufe 1`

## Symptome ohne Fix

- `<nobr>` tags sichtbar im Text
- U+E003 → Quadrat/Box-Zeichen auf Geräten die PUA nicht rendern
- `//Stufe` pattern (nach HTML-Strip) wenn PUA-Char zwischen Slashes

## Fix in `src/processors/schema-org.ts` → `cleanStepText()`

```typescript
.replace(/<[^>]+>/g, " ")          // HTML-Tags strippen
.replace(/[\uE000-\uF8FF]/g, "")   // PUA-Chars strippen (u.a. U+E003 Linkslauf-Icon)
.replace(/\/\/Stufe/g, "/Linkslauf/Stufe")  // kollabiertes // normalisieren
```

**Reihenfolge wichtig:** erst PUA strippen, dann `//Stufe` ersetzen — sonst matcht der Regex nicht.

## Debugging-Tipp

```bash
node -e "
const db = require('better-sqlite3')('./data/rezepti-react.db');
const row = db.prepare('SELECT steps FROM recipes ORDER BY created_at DESC LIMIT 1').get();
const steps = JSON.parse(row.steps);
const s = steps[5];
console.log([...s].map(c => c.codePointAt(0).toString(16)).join(' '));
"
```

→ Zeigt Codepoints. `e003` im Output = PUA-Zeichen.

## LLM für Cookidoo abschalten

Cookidoo liefert vollständige Schema.org-Daten (name, ingredients, steps, duration) auf Deutsch.
`refineRecipe()` (LLM) wird **nicht mehr aufgerufen** wenn alle Pflichtfelder vorhanden sind.
Stattdessen: `finalizeRecipe()` in `src/processors/schema-org.ts` — füllt nur `emoji` (via `pickEmoji()`) und `tags`.

**Why:** Vermeidet API-Latenz, verhindert dass das LLM Sondersymbole/Schritte verändert.
