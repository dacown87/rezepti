# Learnings: PDF-Fixes & Logo — 2026-03-31

## 1. jsPDF kann keine Unicode-Emoji rendern

**Problem:** `doc.text(`${recipe.emoji} ${recipe.name}`)` mit der eingebauten Helvetica-Schrift produziert Fehler oder leere Zeichen.

**Lösung:** Emoji grundsätzlich aus allen `doc.text()`-Aufrufen heraushalten. Nur `recipe.name` übergeben.

**Gilt für:** Einzelrezept-PDF (`generateRecipePDF`) und Karten-PDF (`generateRecipeCardsPDF`).

---

## 2. Karten-PDF: cardHeight-Berechnung overflow

**Problem:** `cardHeight = (pageHeight - margin * 3) / 4` ergibt bei 4 Reihen à margin=10mm:
- 10 + 4×66.75 + 3×10 = 307mm > 297mm (A4) → letzte Reihe wird abgeschnitten

**Fix:** `margin * 5` (oben + 3 interne Lücken + unten):
```typescript
const cardHeight = (pageHeight - margin * 5) / 4  // = 61.75mm
```

---

## 3. QR-Code-Overlap bei Einzelrezept-PDF

**Problem:** `y = doc.internal.pageSize.getHeight() - 50` setzt `y` auf eine feste Position. Wenn der Zubereitungstext länger ist als diese Position, überlappt der QR-Code den Text.

**Fix:** Aktuellen `y`-Stand nutzen + Padding, neue Seite wenn kein Platz:
```typescript
y += 10
if (y > doc.internal.pageSize.getHeight() - 45) {
  doc.addPage()
  y = margin
}
```

---

## 4. Karten-Layout: Von oben bauen vs. von unten bauen

**Erkenntnis:** Bei Karten mit fixen Elementen (QR unten rechts, Titel direkt über QR) ist es sauberer, Positionen von unten zu berechnen:

```typescript
const qrTopY = y + cardHeight - pad - qrSize
const titleBaseline = qrTopY - 3
const tagsBaseline = qrTopY + qrSize / 2 + 1
const imgMaxH = titleBaseline - (y + pad) - 4
```

Damit füllt das Bild automatisch den restlichen Platz oben aus.

---

## 5. Aspect-Ratio bei Bildern in jsPDF

**Problem:** `doc.addImage(url, 'JPEG', x, y, fixedW, fixedH)` streckt das Bild auf die angegebene Größe.

**Fix:** Bild in ein `Image`-Element laden, `naturalWidth/naturalHeight` auslesen, dann mit `Math.min`-Scale korrekt skalieren:

```typescript
const img = new Image()
img.src = dataUrl
await new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve() })
const scale = Math.min(maxW / (img.naturalWidth || maxW), maxH / (img.naturalHeight || maxH))
const drawW = (img.naturalWidth || maxW) * scale
const drawH = (img.naturalHeight || maxH) * scale
doc.addImage(dataUrl, 'JPEG', x + (maxW - drawW) / 2, y, drawW, drawH)
```

---

## 6. Logo.png muss in public/ UND frontend/public/ liegen

**Problem:** `public/Logo.png` fehlt → Server gibt 404.

**Hintergrund:**
- `public/` = wird vom Express-Server direkt ausgeliefert (Production)
- `frontend/public/` = wird von Vite in den Build kopiert → landet ebenfalls in `public/` nach `npm run build:react`

**Faustregel:** Statische Assets die der Server direkt serven soll in beide Ordner legen. Nach einem `npm run build:react` sind sie automatisch synchron.

---

## 7. Service Worker cached alte JS-Bundles

**Symptom:** Code-Änderungen sind im Bundle (`grep` bestätigt), aber im Browser läuft noch die alte Version.

**Diagnose:** Vite baut inhaltsbasierte Hashes (`main-DH7baMON.js`). Wenn sich der Hash ändert, muss der Browser die neue Datei laden. Aber ein alter Service Worker kann den alten Bundle-Namen noch im Cache haben.

**Lösung:**
1. `npm run build:react` → neuer Hash → Browser lädt zwangsläufig neu
2. Falls immer noch alt: F12 → Application → Storage → "Clear site data"

**Automatische Lösung:** `skipWaiting()` + `clientsClaim()` sind im generierten `sw.js` aktiv — nach einem Reload mit neuem Bundle-Hash greift der neue SW sofort.

---

## 8. Git push rejected wegen Remote-Commits (CI/CD)

**Ursache:** GitHub Actions committed automatisch (z.B. Version bump `chore: v1.0.xx`) direkt nach jedem Merge auf `main`.

**Standard-Fix:**
```bash
git pull --rebase && git push
```

Falls unstaged changes vorhanden:
```bash
git stash && git pull --rebase && git stash pop && git push
```
