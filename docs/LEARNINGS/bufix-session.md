# Learnings: bufix Session (2026-03-29)

## Was gemacht wurde

- Branch `bufix` von `main` erstellt
- Implementierungsplan geschrieben in `docs/implementation-plan-bufix.md`
- 4 Phasen via parallele Agents implementiert:
  1. QR-Button aus Navigation entfernt (Layout.tsx)
  2. `pdf_created` Migration hinzugefügt (db-react.ts)
  3. QR-Code Import als neuer Tab + Kamera/File-Aufteilung (ExtractionPage.tsx)
  4. QR-Scan im Wochenplan Tag-Modal (PlannerPage.tsx)

---

## Patterns Discovered

### Pattern: Parallele Agent-Ausführung für unabhängige Tasks
- **Context:** Wenn mehrere, unabhängige Feature-Entwicklungen in einer Session gemacht werden sollen
- **Implementation:** Mehrere `task` Calls mit `subagent_type: general` parallel starten
- **Example:**
  ```typescript
  // 4 parallele Agents für 4 unabhängige Phasen
  task(description: "Phase 0: Remove QR button", prompt: "...", subagent_type: "general")
  task(description: "Phase 1: Add migration", prompt: "...", subagent_type: "general")
  task(description: "Phase 2+3: QR tab + camera/file", prompt: "...", subagent_type: "general")
  task(description: "Phase 4: QR in planner modal", prompt: "...", subagent_type: "general")
  ```

### Pattern: Database Migration mit try/catch
- **Context:** SQLite ALTER TABLE kann fehlschlagen wenn Spalte bereits existiert
- **Implementation:**try/catch um ALTER TABLE Statements
- **Example:**
  ```typescript
  // db-react.ts
  try { db.$client.exec(`ALTER TABLE recipes ADD COLUMN pdf_created INTEGER DEFAULT 0`); } catch {}
  ```

### Pattern: QR-Scanning via BarcodeDetector API
- **Context:** QR-Codes in React scannen
- **Implementation:** Video-Element + BarcodeDetector API im useEffect
- **Example:** Siehe `ScannerPage.tsx` und neue Implementation in `PlannerPage.tsx`

---

## Best Practices Applied

1. **Plan zuerst dokumentieren**
   - Warum: Klare Reihenfolge, Risiken vorher identifizieren
   - Wann: Bei jeder Feature-Implementierung mit mehreren Steps

2. **Codemaps lesen vor Implementierung**
   - Warum: Schneller Überblick über Struktur ohne jeden File zu lesen
   - Wann: Bei unbekannten Codebereichen

3. **Build nach Änderungen ausführen**
   - Warum: Typfehler frühzeitig erkennen
   - Wann: Immer nach Frontend-Änderungen

4. **Parallele Agent-Ausführung bei unabhängigen Tasks**
   - Warum: 4x speedup wenn Tasks nicht voneinander abhängen
   - Wann: Bei mehreren unabhängigen Feature-Entwicklungen

---

## Mistakes to Avoid

1. **Agent-Änderungen nicht manuell verifizieren**
   - Was: Agents machen manchmal unerwartete Änderungen
   - Prevention: Immer Build + Typecheck nach Agent-Läufen

2. **Route '/scan' vergessen zu prüfen**
   - Was: Nach Entfernen des Scan-Buttons aus Navigation könnte /scan Route noch existieren
   - Prevention: Prüfen ob /scan Route noch in App.tsx geroutet wird und ggf. entfernen

---

## Instinct Format

```json
{
  "trigger": "Mehrere unabhängige Feature-Entwicklungen in einer Session",
  "action": "Parallele Agents mit task Tool starten, dann Build/Typecheck",
  "confidence": 0.9,
  "source": "session-extraction",
  "timestamp": "2026-03-29T12:00:00Z"
}
```

```json
{
  "trigger": "SQLite Datenbank-Schema erweitern",
  "action": "try/catch um ALTER TABLE Statements nutzen",
  "confidence": 0.95,
  "source": "session-extraction",
  "timestamp": "2026-03-29T12:00:00Z"
}
```

```json
{
  "trigger": "Neue UI-Features in bestehende Components einbauen",
  "action": "Plan schreiben, Codemaps lesen, dann Agent parallel starten",
  "confidence": 0.85,
  "source": "session-extraction",
  "timestamp": "2026-03-29T12:00:00Z"
}
```
