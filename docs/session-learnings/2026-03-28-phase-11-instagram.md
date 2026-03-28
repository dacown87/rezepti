# Session Learnings: Phase 11 Instagram Verbesserung

**Datum:** 2026-03-28
**Session:** Phase 11 Implementierung

---

## Patterns Discovered

### 1. 2-Phasen-Download für Carousels

**Kontext:** Instagram Carousel-Posts haben mehrere Bilder, aber nicht jeder Post ist ein Carousel.

**Implementierung:**
1. Erst mit `--no-playlist` downloaden und Metadata prüfen
2. Wenn `media_count > 1` oder `media_type === "CAROUSEL_ALBUM"`, dann mit `--yes-playlist` erneut downloaden

```typescript
const files = await downloadWithYtDlp(url, tempDir, ["--no-playlist"]);
const info = JSON.parse(await readFile(join(tempDir, infoFile), "utf-8"));

if (detectCarousel(info)) {
  console.log(`Detected carousel with ${carouselCount} items, re-downloading...`);
  files = await downloadWithYtDlp(url, tempDir, ["--yes-playlist"]);
}
```

**Vorteil:** Vermeidet false positives bei Einzelbildern, keine unnötigen Downloads.

---

### 2. Multi-Image OCR Pipeline

**Kontext:** Instagram-Rezepte haben oft Rezept-Informationen auf mehrere Bilder verteilt (Zutaten, Schritte, Ergebnis).

**Implementierung:** Separate Funktion `extractRecipeFromImages()` die mehrere Bild-URLs an Vision Model übergibt.

```typescript
export async function extractRecipeFromImages(
  imageUrls: string[],
  additionalText?: string
): Promise<RecipeData> {
  const imageParts = imageUrls.map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }));

  const raw = await chatJSON([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: [...imageParts, { type: "text", text: "Extrahiere das Rezept..." }] },
  ], config.groq.visionModel);

  return RecipeDataSchema.parse(raw);
}
```

**Vorteil:** Bessere Extraktion bei Carousel-Posts mit aufgeteilten Informationen.

---

### 3. Fallback-Kaskade

**Kontext:** yt-dlp wird zunehmend von Instagram blockiert.

**Implementierung:** Dreistufige Extraktionsstrategie

```
1. yt-dlp → Vollständiger Download (bevorzugt)
2. Wenn yt-dlp fehlschlägt → Cheerio Web-Scraping (OG metadata)
3. Pipeline → Vision OCR als letzter Fallback
```

```typescript
try {
  const { files, isCarousel } = await detectCarouselAndDownload(url, tempDir);
  // ... process files
} catch (error) {
  console.log(`yt-dlp failed, trying web scraping fallback: ${error}`);
  return await fetchInstagramWebScraping(url);
}
```

**Vorteil:** Robuste Extraktion auch bei Blockaden.

---

## Best Practices Applied

### 1. Incremental Development mit Feature-Detection

**Warum es funktioniert:** Statt alle Fälle upfront zu implementieren, wird zur Laufzeit detektiert was verfügbar ist.

**Anwendung:** Carousel-Detection zur Laufzeit statt statische Konfiguration.

---

### 2. Test-Driven Development

**Warum es funktioniert:** Tests parallel zur Implementierung schreiben zwingt zu sauberen Interfaces.

**Anwendung:** 17 Unit-Tests für Instagram-Utility-Funktionen (`extractHashtags`, `detectCarousel`, `tempDirFromFilename`).

---

### 3. Graceful Degradation

**Warum es funktioniert:** Wenn ein Extraktionspfad fehlschlägt, automatisch auf alternative Pfade zurückfallen.

**Anwendung:** yt-dlp → Web-Scraping → OCR als Kaskade.

---

## Mistakes to Avoid

### 1. Zu frühes Playlist-Download

**Was schief ging:** `--yes-playlist` für alle Instagram-URLs verwenden liefert viele irrelevante Bilder.

**Prävention:** Erst mit `--no-playlist` prüfen, dann nur bei Carousel-Erkennung erneut downloaden.

---

### 2. Single-Image-OCR-Annahme

**Was schiefging:** Annahme dass ein Bild für Rezept-Extraktion reicht, aber Instagram hat oft Zutaten/Schritte/Ergebnis auf mehrere Bilder verteilt.

**Prävention:** Immer alle verfügbaren Bilder für OCR verwenden.

---

### 3. Tote Code nicht entfernt

**Was schiefging:** `parseInfoJson()` wurde nie verwendet (tote Funktion).

**Prävention:** Regelmäßig unbenutzte Funktionen entfernen, Code-Reviews.

---

## Reusable Snippets

### Carousel Detection

```typescript
function detectCarousel(info: any): boolean {
  return (
    (info.media_count && info.media_count > 1) ||
    info.media_type === "CAROUSEL_ALBUM" ||
    (info.children?.length && info.children.length > 0)
  );
}
```

### Hashtag Extraction

```typescript
function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? [...new Set(matches)] : [];
}
```

### Multi-Image Vision API Call

```typescript
const imageParts = imageUrls.map((url) => ({
  type: "image_url" as const,
  image_url: { url },
}));

await chatJSON([
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: [...imageParts, { type: "text", text: prompt }] },
], model);
```

### Web-Scraping Fallback

```typescript
async function fetchWithFallback(url: string): Promise<ContentBundle> {
  try {
    return await fetchWithYtDlp(url);
  } catch (error) {
    console.log(`yt-dlp failed: ${error}, trying web scraping...`);
    return await fetchWithCheerio(url);
  }
}
```

---

## Nächste Schritte

Diese Patterns können für Phase 12 (TikTok) wiederverwendet werden:

1. **Video OCR:** TikTok hat ähnliche Carousel-Problematik mit Video-Overlays
2. **Fallback-Kaskade:** TikTok ebenfalls oft von yt-dlp blockiert
3. **Multi-Image:** TikTok Carousels ebenfalls unterstützen
