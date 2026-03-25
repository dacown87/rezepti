# UI-Verbesserungen

**Branch:** `ui-improvements`  
**Datum:** 25.03.2026

---

## 1. Import-Warnungen fixen

**Problem:** "Erfolgreich extrahiert" erscheint ~20x bei ~5% der Imports

**Ursache:** Wahrscheinlich doppelter Polling-Aufruf oder mehrfache Status-Updates

**Dateien:**
- `src/api-react.ts` - Polling-Endpoint
- `frontend/src/api/services.js` - Frontend Polling-Logik

**Lösung:** Prüfen ob mehrfache `/extract/react/:jobId` Aufrufe pro Poll passieren

---

## 2. Portionsgröße (+/-) Buttons

**Datei:** `frontend/src/components/RecipeCard.tsx` oder `RecipeModal.tsx`

**Aktuell:**
```
[4] [-] [+]
```

**Neu:**
```
Portionen: 4
[-] [+]
```
(Buttons unter der Angabe in eigener Zeile, größer)

---

## 3. Quellen-Button

**Datei:** `frontend/src/components/RecipeModal.tsx`

**Änderung:** 
- "Quellen" (Plural) oben entfernen
- "Quelle" (Singular) unten behalten

---

## 4. Löschen-Button Position

**Datei:** `frontend/src/components/RecipeModal.tsx`

**Änderung:** Löschen-Button aus der Button-Zeile neben "Bearbeiten" entfernen

---

## 5. Löschen mit Modal statt Toast

**Datei:** `frontend/src/components/RecipeModal.tsx`

**Aktuell:** `toast.warn("Rezept wird gelöscht...")` mit Bestätigung

**Neu:** Confirmation-Modal mit:
- Text: "Rezept wird dauerhaft gelöscht"
- Button: "Abbrechen" (grau)
- Button: "Löschen" (rot)

---

## Umsetzungsreihenfolge

1. Import-Warnungen fixen (Backend)
2. RecipeModal.tsx: Quellen, Löschen-Button, Modal
3. RecipeCard.tsx: Portions-Buttons
