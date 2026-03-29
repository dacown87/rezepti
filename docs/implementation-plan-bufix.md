# Implementierungsplan: Bugfixes und Feature-Erweiterungen

**Datum:** 2026-03-29  
**Branch:** `bufix`

---

## Requirements

1. **Bugfix:** `pdf_created` Spalte fehlt in der Datenbank
2. **Feature:** QR-Code Import als neuer Tab im Rezept-Import (neben URL und Foto)
3. **Feature:** Foto-Import aufgeteilt in "Kamera" und "Datei"
4. **Feature:** Im Wochenplan beim Klick auf einen Tag: QR-Scan Button oben im Modal
5. **Entfernen:** QR-Code Button aus dem Hauptmenü (da Funktion nun im Rezept-Import)

---

## Implementation Phases

### Phase 0: Hauptmenü QR-Button entfernen

| Step | Datei | Action |
|------|-------|--------|
| 0.1 | `frontend/src/components/Layout.tsx` | QR-Code Button/Scan-Link aus dem Hauptmenü entfernen |

---

### Phase 1: Datenbank-Bugfix (pdf_created)

| Step | Datei | Action |
|------|-------|--------|
| 1.1 | `src/db-react.ts` | Migration für `pdf_created` Spalte hinzufügen |
| 1.2 | - | Server starten und Migration testen |

---

### Phase 2: ExtractionPage - QR-Code Import Tab

| Step | Datei | Action |
|------|-------|--------|
| 2.1 | `frontend/src/components/ExtractionPage.tsx` | `Mode` Typ erweitern zu `'url' \| 'photo' \| 'qr'` |
| 2.2 | `frontend/src/components/ExtractionPage.tsx` | Toggle-Buttons um QR-Button erweitern |
| 2.3 | `frontend/src/components/ExtractionPage.tsx` | QR-Modus UI implementieren (Kamera + Datei-Upload) |
| 2.4 | `frontend/src/utils/recipe-qr.ts` | Import-Funktion für QR-Rezepte (bestehende ScannerPage Logik wiederverwenden) |

---

### Phase 3: ExtractionPage - Foto-Modus aufteilen

| Step | Datei | Action |
|------|-------|--------|
| 3.1 | `frontend/src/components/ExtractionPage.tsx` | Mode aufteilen: `'camera' \| 'file'` (statt `photo`) |
| 3.2 | `frontend/src/components/ExtractionPage.tsx` | Zwei Buttons anzeigen: "Kamera" und "Datei auswählen" |
| 3.3 | `frontend/src/components/ExtractionPage.tsx` | Input-Handler für beide Modi implementieren |

---

### Phase 4: Wochenplan - QR-Button im Tag-Modal

| Step | Datei | Action |
|------|-------|--------|
| 4.1 | `frontend/src/components/PlannerPage.tsx` | State für QR-Modus im Modal: `showQRScanner` (boolean) |
| 4.2 | `frontend/src/components/PlannerPage.tsx` | Im Add-Modal oben QR-Button hinzufügen |
| 4.3 | `frontend/src/components/PlannerPage.tsx` | QR-Scanner-UI im Modal einbauen (von ScannerPage adaptieren) |
| 4.4 | `frontend/src/components/PlannerPage.tsx` | Scanntes Rezept direkt zum Plan hinzufügen |

---

## Dependencies

- **Extern:** Keine
- **Intern:**
  - `ScannerPage.tsx` - Bestehende QR-Logik wiederverwenden
  - `recipe-qr.ts` - QR-Kodierung/Dekodierung vorhanden
  - `db-react.ts` - Bestehende Migrations-Patterns

---

## Risks

| Severity | Description |
|----------|-------------|
| MEDIUM | BarcodeDetector API nur in Chromium-Browsern (Chrome/Edge) — kein Firefox/Safari |
| MEDIUM | Kamera-Zugriff im Modal könnte auf Mobilgeräten Probleme machen |
| LOW | Datenbank-Migration: try/catch für Fall dass Spalte bereits existiert |

---

## Zeitplanung

| Phase | Beschreibung | Geschätzte Zeit |
|-------|-------------|-----------------|
| Phase 0 | Hauptmenü QR-Button entfernen | 10 Min |
| Phase 1 | DB-Bugfix | 30 Min |
| Phase 2 | QR-Code Import Tab | 1 Stunde |
| Phase 3 | Foto-Import aufteilen | 30 Min |
| Phase 4 | Wochenplan QR-Button | 1-1.5 Stunden |
| **Total** | | **~3-3.5 Stunden** |

---

## Reihenfolge

1. Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
