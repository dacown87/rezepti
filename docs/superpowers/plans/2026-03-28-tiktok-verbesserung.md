---
status: PLANNING
last_reviewed: 2026-03-28
feature: TikTok Verbesserung (70% → 100%)
priority: 4
---

# Plan: TikTok-Integration vollständig

## Ziel

TikTok-Videos mit Text-Overlays, Kommentaren und regionalen Blöcken zuverlässig extrahieren.

---

## Aktuelle Situation (70%)

### Funktioniert ✅
1. **Basisfetcher:** `src/fetchers/tiktok.ts`
2. **URL-Typen:** `tiktok.com/@user/video/123456789`
3. **Audio:** Videos werden für Whisper-Transcription heruntergeladen
4. **Metadata:** Titel, Beschreibung aus info.json

### Probleme (30%) ❌

**1. Text-in-Video Overlays (15%):**
- **Kritische Lücke:** TikTok-Rezepte zeigen Zutaten/Schritte als Text-Overlay
- Keine OCR für eingebetteten Text in Videos
- Vision Model (Llama 4 Scout) nicht genutzt

**2. Kommentar-Extraktion (5%):**
- Wertvolle Rezeptdetails in Kommentaren gehen verloren
- Keine yt-dlp `--write-comments` Option
- Keine Verarbeitung von Kommentar-Daten

**3. Regionale Blöcke (5%):**
- TikTok hat strenge EU/DE Geoblocking
- Keine Proxy- oder Region-Fallback-Strategie
- `--geo-bypass-country` nicht genutzt

**4. Mobile URLs (2%):**
- Kurz-URLs `vm.tiktok.com`, `vt.tiktok.com` nicht erkannt
- Mobile vs. Desktop URLs nicht unterschieden

**5. Feature-Verlust (3%):**
- Weniger Features als Instagram-Fetcher
- Keine lokale Bildverarbeitung
- Kein Thumbnails-Array Support

---

## Implementierungs-Phasen

### Phase 1: Video OCR für Text-Overlays (3 Tage)

**1. Frame-Extraktion aus Videos:**
```typescript
// FFmpeg für Frame-Extraktion
await execFileAsync("ffmpeg", [
  "-i", videoPath,
  "-vf", "fps=1",  // 1 Frame pro Sekunde
  "-q:v", "2",     // Qualität
  join(tempDir, "frame-%04d.jpg")
]);
```

**2. Vision Model Integration:**
- Bestehende `LlamaProcessor` (`src/processors/llm.ts`)
- Batch-Verarbeitung für Frames
- Text-Erkennung aus Video-Overlays

**3. Text-Aggregation:**
- Kombiniere Text aus allen Frames
- Deduplizierung gleicher Text-Blöcke
- Strukturierung: Zutaten, Schritte, Notizen

**4. Performance-Optimierung:**
- Max. 10 Frames pro Video (1 fps = 10s Video)
- Cache für gleiche Videos
- Config: `TIKTOK_OCR_ENABLED=true/false`

### Phase 2: Kommentar-Extraktion (2 Tage)

**1. Enhanced yt-dlp Options:**
```typescript
await execFileAsync("yt-dlp", [
  "--write-info-json",
  "--write-thumbnail",
  "--write-comments",     // NEU
  "--comments-limit", "50", // NEU
  "-o", outTemplate,
  url,
], { timeout: 120_000 });
```

**2. Kommentar-Verarbeitung:**
```typescript
function extractRecipeFromComments(comments: any[]): string {
  // Filtere relevante Kommentare (Keywords: "Zutat", "Rezept", "Tipp")
  // Extrahiere Rezeptdetails
  // Kombiniere mit Haupttext
}
```

**3. Integration in ContentBundle:**
- Neue Felder: `comments`, `commentCount`
- Kombinierter Text: `description + topComments`
- Weighting: Haupttext > Kommentare

### Phase 3: Regionale Fallbacks (2 Tage)

**1. Multi-Region Versuche:**
```typescript
const regions = ["de", "us", "fr", "uk", "ca"];
for (const region of regions) {
  try {
    await execFileAsync("yt-dlp", [
      "--geo-bypass-country", region,
      // ... andere Optionen
    ]);
    break; // Erfolg
  } catch {
    continue; // Nächste Region
  }
}
```

**2. Proxy-Support:**
- Config: `TIKTOK_PROXY_URL` optional
- yt-dlp `--proxy` Parameter
- Fallback zu region-based approach

**3. Mobile URL Support:**
```typescript
// classifier.ts erweitern
["tiktok", /(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\//i],
```

### Phase 4: Feature-Parität mit Instagram (1 Tag)

**1. Bildverarbeitung hinzufügen:**
- Lokale Bilder finden und zu `imageUrls` hinzufügen
- `slice(0, 5)` Limitierung

**2. Thumbnails-Array Support:**
```typescript
if (info.thumbnails) {
  for (const t of info.thumbnails) {
    if (t.url) imageUrls.push(t.url);
  }
}
```

**3. Code-Konsolidierung:**
- Gemeinsame Logik in `shared/social-fetcher.ts`
- Wiederverwendung von Instagram-Features

---

## Technische Details

### Video OCR Pipeline

```
TikTok Video (60s)
├── Frame Extraction: 60 Frames @ 1fps
├── Frame Selection: 10 repräsentative Frames
├── Vision Model: Text-OCR pro Frame
├── Text Aggregation: Kombiniere + dedupliziere
└── Output: Rele Text aus Video-Overlays
```

### Kommentar-Extraktion Strategie

```typescript
interface TikTokComment {
  text: string;
  likes: number;
  timestamp: number;
}

function prioritizeComments(comments: TikTokComment[]): string[] {
  // 1. Filter nach Rezept-Keywords
  // 2. Sortieren nach Likes (Populärste zuerst)
  // 3. Limit: Top 10 Kommentare
  // 4. Extrahiere Rezept-spezifische Informationen
}
```

### Region-Fallback Algorithmus

```typescript
async function fetchTikTokWithRegionFallback(
  url: string, 
  tempDir: string
): Promise<ContentBundle> {
  const regions = ["de", "us", "fr", "uk", "ca", "au"];
  const errors: string[] = [];
  
  for (const region of regions) {
    try {
      return await fetchTikTokRegion(url, tempDir, region);
    } catch (error) {
      errors.push(`${region}: ${error.message}`);
      if (shouldStop(error)) break;
    }
  }
  
  throw new Error(`Alle Regionen fehlgeschlagen: ${errors.join(", ")}`);
}
```

---

## Risiko-Analyse

| Risiko | Level | Mitigation |
|--------|-------|------------|
| OCR Performance | MEDIUM | Frame-Limits, Caching |
| Region-Änderungen | MEDIUM | Regular yt-dlp updates |
| Kommentar-Rate-Limits | LOW | `--comments-limit 50` |
| API-Breaking Changes | MEDIUM | Fallback zu Video-only |

---

## Erfolgskriterien

- [ ] **Video OCR:** Text aus Overlays wird extrahiert
- [ ] **Kommentare:** Top 50 Kommentare werden verarbeitet
- [ ] **Regionale Blöcke:** Mindestens 1 Region funktioniert
- [ ] **Mobile URLs:** `vm.tiktok.com` wird erkannt
- [ ] **Feature-Parität:** Gleiche Features wie Instagram

---

## Geschätzter Aufwand

**8 Tage** (~1.5 Wochen)

- Phase 1: 3 Tage (Video OCR)
- Phase 2: 2 Tage (Kommentare)
- Phase 3: 2 Tage (Regionale Fallbacks)
- Phase 4: 1 Tag (Feature-Parität)

---

## Verwandte Dateien

| Datei | Änderung |
|-------|----------|
| `src/fetchers/tiktok.ts` | Haupt-Erweiterung |
| `src/classifier.ts` | Mobile URLs hinzufügen |
| `src/processors/llm.ts` | OCR-Integration |
| `src/config.ts` | Region/Proxy Config |
| `test/unit/tiktok.test.ts` | Erweiterte Tests |
| `src/fetchers/shared/social-fetcher.ts` | **NEU** (gemeinsame Logik) |

---

## Abhängigkeiten

1. **FFmpeg:** Für Frame-Extraktion (optional)
2. **Groq Vision API:** Für OCR (bereits integriert)
3. **yt-dlp:** Bleibt Hauptwerkzeug
4. **Proxy-Service:** Optional für regionale Blöcke

---

## Offene Fragen

1. **FFmpeg Abhängigkeit:** Ist FFmpeg auf allen Systemen verfügbar?
2. **OCR Kosten:** Vision Model ist kostenpflichtig – wie viele Frames pro Video?
3. **Performance:** Video OCR kann langsam sein – Timeout erhöhen?
4. **Legal:** Ist OCR von TikTok-Videos erlaubt?

---

## Fortschritt

- [ ] Phase 1: Video OCR für Text-Overlays
- [ ] Phase 2: Kommentar-Extraktion  
- [ ] Phase 3: Regionale Fallbacks
- [ ] Phase 4: Feature-Parität mit Instagram