# Session Learning: Phase 12 TikTok-Integration

## Patterns Discovered

### Regionaler Fallback mit Geo-Bypass

Bei Geo-blockierten Plattformen wie TikTok loopt man durch Region-Codes und nutzt `--geo-bypass-country`.

```typescript
const TIKTOK_REGIONS = ["de", "us", "fr", "uk", "ca", "au"];
for (const region of TIKTOK_REGIONS) {
  try {
    return await fetchWithRegion(url, region);
  } catch { continue; }
}
```

### Kommentar-Priorisierung nach Relevanz

Social Media Rezepte haben oft wertvolle Infos in Kommentaren. Keywords-Boost + Likes-Score.

```typescript
function prioritizeComments(comments: any[]): string[] {
  const recipeKeywords = ["zutat", "rezept", "zutaten", "schritt", "tipp"];
  const prioritized = comments.map(c => ({
    text: c.text || "",
    score: (c.likes || 0) + (recipeKeywords.some(k => c.text?.toLowerCase().includes(k)) ? 1000 : 0)
  })).sort((a, b) => b.score - a.score);
  return prioritized.slice(0, 10).map(p => p.text);
}
```

### Video OCR Pipeline

FFmpeg Frame-Extraktion → Base64 Encoding → Vision Model OCR → Text-Aggregation.

```typescript
async function extractTextFromVideoFrames(videoPath: string, tempDir: string): Promise<string> {
  const framePattern = join(tempDir, "frame-%04d.jpg");
  await execFileAsync("ffmpeg", [
    "-i", videoPath,
    "-vf", "fps=1,scale=1280:720",
    "-q:v", "2",
    "-frames:v", "10",
    framePattern,
  ], { timeout: 120_000 });

  const frameFiles = (await readdir(tempDir))
    .filter(f => f.startsWith("frame-") && /\.(jpg|jpeg)$/i.test(f))
    .sort();

  for (const frameFile of frameFiles) {
    const frameData = await readFile(join(tempDir, frameFile));
    const base64Image = frameData.toString("base64");
    const result = await extractRecipeFromImage(
      `data:image/jpeg;base64,${base64Image}`,
      "Extrahiere Zutaten und Schritte."
    );
    // ... aggregate texts
  }
}
```

---

## Best Practices

1. **Immer existierende Exporte prüfen**
   - Vor Import: `grep "export" src/processors/llm.ts`
   - Spart Debugging-Zeit bei API-Änderungen

2. **Config statt Magic Strings**
   - Plattform-Optionen in `config.ts`
   - `process.env.TIKTOK_*` für Flexibility

3. **Feature-Parität mit bestehendem Fetcher**
   - Instagram als Template für TikTok
   - Gleiche Fehlerbehandlung, gleiche Options

4. **Dynamic Import für optionale Features**
   - `await import()` für ffprobe/ffmpeg
   - Graceful fallback wenn nicht verfügbar

---

## Mistakes to Avoid

| Mistake | Prevention |
|---------|------------|
| Falscher Funktionsname importieren | Immer Quelldatei erst lesen |
| Vision OCR ohne Timeout | 120s Timeout für ffmpeg + Vision |
| Alle Frames OCR-en | Max 10 Frames per Video |

---

## Instinct Triggers

```json
{
  "trigger": "Importing functions from llm.ts without checking exports",
  "action": "Always grep/read the source file first to verify exact export names",
  "confidence": 0.9,
  "source": "session-extraction"
}
```

```json
{
  "trigger": "Geo-blocked content from TikTok",
  "action": "Use region fallback loop with TIKTOK_REGIONS array and --geo-bypass-country flag",
  "confidence": 0.85,
  "source": "session-extraction"
}
```
