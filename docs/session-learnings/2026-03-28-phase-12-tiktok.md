# Session Learnings: Phase 12 TikTok-Integration

## Patterns Discovered

### Pattern: Dead Code Detection via Pipeline Integration Check
- **Context:** When implementing new features that export functions but may not be called
- **Implementation:** Always verify exported functions are actually invoked in the main pipeline
- **Example:** `extractTextFromVideoFrames` was exported but never called in `fetchTikTok`. Fixed by adding:
```typescript
let videoOcrText = "";
if (audioPath && config.tiktok.ocrEnabled) {
  videoOcrText = await extractTextFromVideoFrames(audioPath, tempDir);
}
```

### Pattern: Type-Safe Comment Prioritization
- **Context:** Social media comments need scoring based on relevance keywords + engagement
- **Implementation:** Define explicit interfaces instead of `any[]` for better TypeScript safety
- **Example:**
```typescript
interface TikTokComment {
  text?: string;
  body?: string;
  like_count?: number;
  likes?: number;
}

export function prioritizeComments(comments: TikTokComment[]): string[] {
  const recipeKeywords = ["zutat", "rezept", "zutaten", "schritt", "tipp"];
  const prioritized = comments.map(c => ({
    text: c.text || c.body || "",
    score: (c.like_count || c.likes || 0) + 
           (recipeKeywords.some(k => c.text?.toLowerCase().includes(k)) ? 1000 : 0)
  })).sort((a, b) => b.score - a.score);
  return prioritized.slice(0, 10).map(p => p.text);
}
```

### Pattern: Region Fallback for Geo-Blocked Platforms
- **Context:** TikTok, Instagram may be geo-blocked in certain regions
- **Implementation:** Loop through region codes with `--geo-bypass-country` flag
- **Example:**
```typescript
const TIKTOK_REGIONS = ["de", "us", "fr", "uk", "ca", "au"];
for (const region of TIKTOK_REGIONS) {
  try {
    return await fetchWithRegion(url, region);
  } catch { continue; }
}
```

---

## Best Practices Applied

1. **Export Helper Functions for Testability**
   - Why: Enables direct unit testing without mocking entire pipeline
   - When: Any pure function that could be tested independently

2. **Interface over any Types**
   - Why: TypeScript provides compile-time safety, catches bugs early
   - When: Working with external API responses (yt-dlp JSON, comments)

3. **Console.warn for Non-Critical Failures**
   - Why: OCR frame failures shouldn't crash the pipeline, but should be visible in logs
   - When: Graceful degradation in optional features

4. **Comprehensive Unit Tests Before Review**
   - Why: Code review is more productive with good test coverage
   - When: All new features should have >80% test coverage

---

## Mistakes to Avoid

| Mistake | What Went Wrong | Prevention |
|---------|-----------------|------------|
| Dead Code | `extractTextFromVideoFrames` defined but never called | Always trace exported functions through the pipeline |
| any Types | Used `any[]` for comments | Define interfaces for external data structures |
| Silent Failures | OCR catch blocks swallowed errors | Add console.warn for visibility |
| Missing Tests | No tests for classifier URL patterns | Add tests for all classification paths |

---

## Reusable Snippets

### Region Fallback Loop
```typescript
const REGIONS = ["de", "us", "fr", "uk", "ca", "au"];
async function fetchWithRegionFallback(url: string, tempDir: string) {
  for (const region of REGIONS) {
    try {
      return await fetchWithRegion(url, tempDir, region);
    } catch (error: any) {
      if (error.message.includes("Private") || error.message.includes("Deleted")) {
        throw error; // Don't retry permanent failures
      }
      continue; // Try next region
    }
  }
  throw new Error("All regions failed");
}
```

### Comment Prioritization with Keywords
```typescript
function prioritizeByKeywords<T extends { text?: string; likes?: number }>(
  items: T[],
  keywords: string[],
  boost: number = 1000
): T[] {
  return items
    .map(item => ({
      item,
      score: (item.likes || 0) + 
             (keywords.some(k => item.text?.toLowerCase().includes(k)) ? boost : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}
```

---

## Instinct Triggers

```json
{
  "trigger": "Function exported but pipeline doesn't call it",
  "action": "Search for function usage in pipeline before assuming it's working",
  "confidence": 0.9,
  "source": "session-extraction"
}
```

```json
{
  "trigger": "External API response typed as any[]",
  "action": "Define TypeScript interface for the data structure",
  "confidence": 0.85,
  "source": "session-extraction"
}
```

```json
{
  "trigger": "Geo-blocked content from social platforms",
  "action": "Use region fallback loop with --geo-bypass-country flag",
  "confidence": 0.9,
  "source": "session-extraction"
}
```

---

## Related Documents

- `docs/superpowers/plans/2026-03-28-tiktok-verbesserung.md` - Phase 12 Plan
- `docs/session-learnings/phase-12-tiktok.md` - Previous TikTok learnings
- `test/unit/tiktok.test.ts` - TikTok unit tests
- `test/unit/classifier.test.ts` - URL classification tests
