---
status: COMPLETED
last_reviewed: 2026-03-28
feature: Instagram Verbesserung (70% → 95%)
priority: 3
phase: 11
branch: phase/11-instagram-verbesserung
---

# Plan: Instagram-Integration vollständig

## Ziel

Instagram-Posts, Reels, Carousels, Stories zuverlässig extrahieren (von 70% auf 100%).

---

## Aktuelle Situation (70%)

### Funktioniert ✅
1. **Basisfetcher:** `src/fetchers/instagram.ts`
2. **URL-Typen:** `/p/` (Posts), `/reel/` (Reels), `/tv/` (IGTV)
3. **Media:** Bilder, Videos werden heruntergeladen
4. **Metadata:** Titel, Beschreibung aus info.json

### Probleme (30%) ❌

**1. Robustheit fehlt (10%):**
- Kein Error-Handling für private/deaktivierte Accounts
- Keine Retry-Logic bei temporären Fehlern  
- Kein Rate-Limit Management

**2. Feature-Lücken (10%):**
- Keine Carousel-Unterstützung (Multi-Image Posts)
- Keine Stories/Highlights Extraktion
- Keine OCR für Text-in-Bildern
- Keine Hashtag/Location Extraction

**3. Metadata-Tiefe (5%):**
- Nur basic yt-dlp metadata
- Keine Instagram-spezifische Felder: likes, comments, timestamp
- Keine Caption-Analyse als alternative Textquelle

**4. Fallback-Strategien (5%):**
- Kein Fallback wenn yt-dlp blockiert
- Keine Alternative für regionale Blöcke
- Keine Cookie/Session-Handling für geschützte Inhalte

---

## Implementierungs-Phasen

### Phase 1: Robustheits-Verbesserungen (2 Tage)

**1. Enhanced yt-dlp Options:**
```typescript
await execFileAsync("yt-dlp", [
  "--write-info-json",
  "--write-thumbnail",
  "--write-description",  // besserer Text
  "--write-comments",     // falls öffentlich verfügbar
  "--no-playlist",
  "--restrict-filenames",
  "-o", outTemplate,
  url,
], { timeout: 120_000 });
```

**2. Error-Handling Verbessern:**
```typescript
try {
  // yt-dlp execution
} catch (error) {
  if (error.message.includes("Private") || error.message.includes("Deleted")) {
    throw new Error("Instagram-Inhalt privat oder gelöscht");
  }
  if (error.message.includes("Rate limit")) {
    await waitWithExponentialBackoff(retryCount);
    retryCount++;
    continue;
  }
}
```

**3. Rate-Limit Management:**
- Exponential Backoff: 1s, 2s, 4s, 8s
- Max Retries: 3
- User-Agent Rotation optional

### Phase 2: Carousel & Multi-Image Support (3 Tage)

**1. Carousel Erkennung:**
```typescript
function detectCarousel(metadata: any): boolean {
  return metadata.media_count > 1 || 
         metadata.media_type === "CAROUSEL_ALBUM";
}
```

**2. Multi-Image Download:**
- yt-dlp mit `--yes-playlist` für Carousels
- Alle Bilder im Carousel herunterladen
- Reihenfolge erhalten: `image1.jpg`, `image2.jpg`, etc.

**3. Caption Aggregation:**
- Haupt-Caption + Bild-spezifische Captions
- OCR für Text in Carousel-Bildern
- Strukturierte Ausgabe: Carousel-Schritte

### Phase 3: OCR & Text-Extraction (2 Tage)

**1. Vision Model Integration:**
- Bestehende `LlamaProcessor` (`src/processors/llm.ts`)
- Reuse für Text-OCR aus Bildern
- Batch-Verarbeitung für Carousels

**2. Text Extraction Pipeline:**
```
1. Caption aus Instagram metadata
2. Alt-text falls verfügbar
3. OCR aus Bildern (Vision Model)
4. Kombination für vollständigen Text
```

**3. Performance-Optimierung:**
- Nur OCR wenn Caption zu kurz
- Cache für gleiche Bilder
- Config: `OCR_MIN_LENGTH=50` (Zeichen)

### Phase 4: Fallback-Strategien (2 Tage)

**1. Headless Browser Fallback:**
- Puppeteer oder Playwright wenn yt-dlp blockiert
- Cookie-Injection für regionale Inhalte
- JavaScript-Rendering für geschützte Pages

**2. Instagram Web-Scraping:**
- Alternative zu yt-dlp
- Open Graph metadata extrahieren
- Browser-Emulation für private Inhalte

**3. Session-Management (optional):**
- Instagram Login-Credentials in Settings
- Cookie-Jar Persistenz
- OAuth für Business-Accounts

---

## Technische Details

### Erweiterte Metadata Extraction

**Vorhanden:**
```json
{
  "title": "...",
  "description": "...",
  "thumbnail": "...",
  "thumbnails": [...]
}
```

**Neu hinzufügen:**
```json
{
  "uploader": "@username",
  "timestamp": 1743210000,
  "like_count": 1234,
  "comment_count": 56,
  "hashtags": ["#food", "#recipe"],
  "location": "Berlin, Germany",
  "is_carousel": true,
  "carousel_count": 5,
  "media_type": "CAROUSEL_ALBUM"
}
```

### Carousel-Struktur

```
Carousel Post (5 Bilder)
├── Main Caption: "Mein Rezept für XYZ..."
├── Image 1: Zutaten-Liste (OCR extrahieren)
├── Image 2: Schritt 1 Anleitung  
├── Image 3: Schritt 2 Anleitung
├── Image 4: Schritt 3 Anleitung
└── Image 5: Fertiges Ergebnis
```

### OCR Pipeline

```typescript
async function extractTextFromImages(imagePaths: string[]): Promise<string[]> {
  const texts: string[] = [];
  
  for (const path of imagePaths) {
    const base64 = await readFile(path, 'base64');
    const ocrResult = await visionModel.ocr({
      image: base64,
      prompt: "Extract recipe text"
    });
    texts.push(ocrResult);
  }
  
  return texts;
}
```

---

## Risiko-Analyse

| Risiko | Level | Mitigation |
|--------|-------|------------|
| Instagram API-Änderung | MEDIUM | yt-dlp updates mitverfolgen |
| Rate Limits | MEDIUM | Exponential Backoff implementieren |
| OCR Performance | MEDIUM | Caching, nur wenn nötig |
| Carousel Complexity | MEDIUM | Schrittweise Implementierung |

---

## Erfolgskriterien

- [ ] **Private/Deleted Accounts:** Fehlermeldung statt Timeout
- [ ] **Carousel Posts:** Unterstützung für Multi-Image Rezepte
- [ ] **Text-Extraction:** OCR wenn Caption unzureichend
- [ ] **Fallback:** Headless Browser wenn yt-dlp blockiert
- [ ] **Performance:** <10s für Carousel mit 5 Bildern

---

## Geschätzter Aufwand

**9 Tage** (~2 Wochen)

- Phase 1: 2 Tage (Robustheit)
- Phase 2: 3 Tage (Carousels)
- Phase 3: 2 Tage (OCR)
- Phase 4: 2 Tage (Fallbacks)

---

## Verwandte Dateien

| Datei | Änderung |
|-------|----------|
| `src/fetchers/instagram.ts` | Haupt-Erweiterung |
| `src/processors/llm.ts` | OCR-Integration |
| `src/config.ts` | Rate-Limit Config |
| `test/unit/instagram.test.ts` | Erweiterte Tests |
| `frontend/src/components/SettingsPage.tsx` | Instagram Credentials optional |

---

## Abhängigkeiten

1. **yt-dlp:** Bleibt Hauptwerkzeug
2. **Groq Vision API:** Für OCR (bereits integriert)
3. **Puppeteer/Playwright:** Optional für Fallback
4. **Instagram API:** Falls öffentlich verfügbar

---

## Offene Fragen

1. **Session-Handling:** Sollen Benutzer Instagram-Credentials eingeben können?
2. **OCR Kosten:** Vision Model ist kostenpflichtig – Limit nötig?
3. **Carousel-Extraction:** Wie detailliert sollen einzelne Bilder extrahiert werden?
4. **Fallback-Strategie:** Headless Browser vs. Instagram Web-API?

---

## Fortschritt

- [x] Phase 1: Robustheits-Verbesserungen (Error Handling + Rate-Limit)
- [x] Phase 2: Carousel Support (Multi-Image Erkennung + Download)
- [x] Phase 2: Enhanced Metadata (hashtags, likes, comments, location)
- [x] Phase 3: OCR Integration (Vision Model) - extractRecipeFromImages für Carousels
- [x] Phase 4: Fallback-Strategien (Web-Scraping Fallback via Cheerio)