---
status: COMPLETED
last_reviewed: 2026-03-28
feature: Facebook Import (0% → 70%)
priority: 6
phase: 14
branch: phase/14-facebook-import
---

# Plan: Facebook-Import mit Risiko-Bewertung

## Ziel

Facebook-Videos (Reels) importieren mit realistischer Risiko/Nutzen-Abwägung.

**Warnung:** Facebook-Import ist hochriskant (ToS-Verletzung, Account-Suspension). Empfehlung: Video-only Ansatz.

---

## Aktuelle Situation (0%)

### Platzhalter-Status ❌
```typescript
// src/fetchers/facebook.ts - identisch zu Pinterest
throw new Error("Facebook-Import ist noch nicht implementiert...");
```

### Vorbereitet ✅
1. **Klassifizierung:** `facebook\.com\//` erkannt
2. **Pipeline:** `case "facebook":` existiert
3. **Types:** `SourceType` enthält "facebook"

---

## Risiko-Analyse (KRITISCH)

### **Legal Risk (HIGH):**
**Facebook ToS Section 3.2:**
- "You will not access or collect data from our Products using automated means"
- **Konsequenzen:** IP-Block, Account-Suspension, rechtliche Schritte

### **Technical Risk (HIGH):**
1. **Anti-bot Maßnahmen:** reCAPTCHA v3/Enterprise, Fingerprinting
2. **Rate Limits:** Sehr aggressiv (schnelle IP-Blocks)
3. **Session Management:** Cookies laufen schnell ab (1-7 Tage)
4. **Constant Changes:** HTML-Struktur ändert sich häufig

### **Maintenance Overhead (HIGH):**
- Cat-and-mouse game mit Facebook Security
- Häufige Code-Anpassungen nötig
- User müssen regelmäßig neue Cookies bereitstellen

---

## Realistische Implementierungs-Strategie

### **Option A: Minimal Video-only (Empfohlen)**
- **Fokus:** Nur Facebook Videos/Reels
- **Technik:** yt-dlp (wie Instagram)
- **Limitation:** Kein Text-Post-Scraping
- **Risiko:** Mittel (Video-Download teilweise erlaubt)

### **Option B: Web Fallback (Sicher)**
- **Fokus:** Facebook URLs an `fetchWeb()` delegieren
- **Technik:** Nutzt Open Graph Metadata
- **Limitation:** Nur öffentliche Seiten-Inhalte
- **Risiko:** Niedrig (legal konform)

### **Option C: Graph API (Langfristig)**
- **Fokus:** Offizielle API mit App Review
- **Technik:** OAuth2, Rate Limit Management
- **Limitation:** 4-8 Wochen Review Process
- **Risiko:** Niedrig, aber hoher Initial-Aufwand

---

## Implementierungs-Phasen (Empfohlener Ansatz)

### Phase 1: Video-only mit yt-dlp (→ 50%) - 3 Tage

**Beschränkung auf Video-Content:**
```typescript
async function fetchFacebook(url: string, tempDir: string): Promise<ContentBundle> {
  // Nur Video-URLs unterstützen
  const isVideo = isFacebookVideoUrl(url);
  if (!isVideo) {
    // Fallback: als Web-URL behandeln
    return await fetchWeb(url, tempDir);
  }
  
  // yt-dlp für Videos (wie Instagram)
  return await fetchFacebookVideo(url, tempDir);
}
```

**Video-URL Erkennung:**
```typescript
function isFacebookVideoUrl(url: string): boolean {
  const videoPatterns = [
    /facebook\.com\/.*\/videos\//i,
    /facebook\.com\/watch\//i,
    /fb\.watch\//i,
    /facebook\.com\/reel\//i
  ];
  return videoPatterns.some(pattern => pattern.test(url));
}
```

**yt-dlp Integration (ähnlich zu Instagram):**
```typescript
async function fetchFacebookVideo(url: string, tempDir: string): Promise<ContentBundle> {
  const outTemplate = join(tempDir, "facebook");
  
  try {
    await execFileAsync("yt-dlp", [
      "--write-info-json",
      "--write-thumbnail",
      "--cookies", "facebook-cookies.txt", // Optional
      "-o", outTemplate,
      url,
    ], { timeout: 120_000 });
  } catch (error) {
    if (error.message.includes("login required")) {
      throw new Error("Facebook-Video erfordert Login. Bitte nutze die Web-Import-Funktion.");
    }
    throw error;
  }
  
  // ... Metadata Extraction wie instagram.ts
}
```

### Phase 2: Cookie-Management (→ 60%) - 2 Tage

**Optional: Cookie-Import für login-geschützte Videos:**
```typescript
// SettingsPage: Facebook Cookie Import
interface FacebookSettings {
  cookiesEnabled: boolean;
  cookieFile: string; // Path to cookies.txt
  lastUpdated: number;
}

// Cookie-Import aus Browser
async function importFacebookCookies(): Promise<void> {
  // Benutzer kann cookies.txt exportieren
  // Cookie-Jar für yt-dlp verwenden
}
```

**Rate-Limit Handling:**
- Max 1 Request pro Minute
- Exponential Backoff bei Blocks
- Clear error messages für User

### Phase 3: Open Graph Fallback (→ 70%) - 1 Tag

**Für nicht-Video URLs:**
```typescript
function fetchFacebookPost(url: string): Promise<ContentBundle> {
  // Nur Open Graph Metadata extrahieren
  const html = await fetchWithRateLimit(url);
  const $ = cheerio.load(html);
  
  return {
    url,
    type: "facebook",
    title: $('meta[property="og:title"]').attr('content') || '',
    description: $('meta[property="og:description"]').attr('content') || '',
    textContent: '', // Kein Text-Scraping (Risiko!)
    imageUrls: [$('meta[property="og:image"]').attr('content') || ''],
    audioPath: undefined,
    schemaRecipe: null
  };
}
```

### Phase 4: Graph API Exploration (→ 80%) - Optional, 5+ Tage

**Langfristige Lösung:**
1. **App Registration:** Facebook Developer Account
2. **App Review:** 4-8 Wochen Prozess
3. **OAuth2 Integration:** User Authentication
4. **Rate Limit Management:** 200 calls/hour

**API-Endpunkte:**
```typescript
// Nur öffentliche Seiten-Inhalte ohne Review
GET /{page-id}/feed?fields=message,full_picture
GET /{video-id}?fields=description,title
```

---

## Risiko-Minderungs-Strategien

### **Technische Minderung:**
1. **Rate Limiting:** Max 1 Request pro Minute
2. **User-Agent Rotation:** Realistische Browser-User-Agents
3. **Cookie-Compliance:** User müssen Cookies selbst bereitstellen
4. **No Persistent Sessions:** Keine automatischen Logins

### **Legal Minderung:**
1. **Clear ToS Warning:** Benutzer müssen Risiko bestätigen
2. **Video-only Focus:** Video-Download weniger restriktiv
3. **User Responsibility:** Cookies von Usern, nicht von uns
4. **Disclosure:** Klare Hinweise auf ToS-Verletzung

### **User Experience Minderung:**
1. **Graceful Degradation:** Fallback zu `fetchWeb()`
2. **Clear Error Messages:** "Login required" statt Timeout
3. **Cookie Import Guide:** Step-by-step Anleitung
4. **Opt-in Feature:** Facebook muss aktiviert werden

---

## Erfolgskriterien (angepasste Erwartungen)

- [ ] **Video-Extraktion:** Facebook Videos/Reels können importiert werden
- [ ] **Cookie-Support:** Optional für login-geschützte Videos
- [ ] **Fallback:** Nicht-Video URLs werden an `fetchWeb()` delegiert
- [ ] **Error-Handling:** Klare Fehlermeldungen bei Blocks/Login
- [ ] **Rate Limiting:** Keine IP-Blocks bei normaler Nutzung
- [ ] **ToS-Compliance:** User werden über Risiken informiert

**Nicht geplant:**
- ❌ Text-Post Scraping (zu riskant)
- ❌ Gruppen-Inhalte (technisch/legal unmöglich)
- ❌ Private Profile-Inhalte (Login-Required)
- ❌ Automatisches Login/Session-Management

---

## Geschätzter Aufwand

**6 Tage** (mit reduziertem Scope)

- Phase 1: 3 Tage (Video-only)
- Phase 2: 2 Tage (Cookie-Management)
- Phase 3: 1 Day (Open Graph Fallback)
- Phase 4: 5+ Tage (Graph API, optional)

---

## Warnungen & Einschränkungen

### **BENUTZER-WARNUNG:**
```
⚠️ FACEBOOK-IMPORT WARNUNG

Facebook's Nutzungsbedingungen verbieten automatisiertes Scraping.
Durch die Nutzung dieses Features riskieren Sie:

1. IP-Blockierung durch Facebook
2. Suspension Ihres Facebook-Accounts  
3. Rechtliche Konsequenzen (unwahrscheinlich, aber möglich)

Dieses Feature ist nur für:
- Öffentliche Videos/Reels
- Mit selbst bereitgestellten Cookies
- In moderater Frequenz (max. 1/Minute)

✅ Ich verstehe die Risiken und möchte fortfahren
❌ Abbrechen und Web-Import nutzen
```

### **Technische Einschränkungen:**
1. Max. 1 Request pro Minute
2. Keine Text-Post Extraktion
3. Keine Gruppen/Private Inhalte
4. Cookies müssen manuell importiert werden
5. Häufige Wartung nötig (Facebook ändert sich oft)

---

## Verwandte Dateien

| Datei | Änderung |
|-------|----------|
| `src/fetchers/facebook.ts` | Video-only Implementierung |
| `frontend/src/components/SettingsPage.tsx` | Facebook Warning + Cookie Import |
| `src/fetchers/web.ts` | Fallback für nicht-Video URLs |
| `docs/facebook-risks.md` | **NEU** (Risiko-Dokumentation) |
| `test/unit/facebook.test.ts` | Eingeschränkte Tests |

---

## Empfehlung

**Priorität: LOW** - Facebook-Import sollte niedrig priorisiert werden aufgrund:

1. **Hohes Risiko:** ToS-Verletzung, Account-Suspension
2. **Geringer Nutzen:** Rezepte primär in Videos, die via yt-dlp importierbar sind
3. **Hoher Wartungsaufwand:** Constant cat-and-mouse mit Facebook Security
4. **Bessere Alternativen:** Instagram/TikTok/YouTube haben weniger Restriktionen

**Wenn implementiert:** Als "experimentelles Feature" mit klaren Warnungen und starken Einschränkungen.

---

## Fortschritt

- [x] Phase 1: Video-only Implementierung (yt-dlp mit Cookie-Support, Retry, Exponential Backoff)
- [x] Phase 2: Cookie-Management (saveFacebookCookies, validateFacebookCookies, clearFacebookCookies)
- [x] Phase 3: Open Graph Fallback (fetchFacebookOGFallback für nicht-Video URLs)
- [x] Phase 4: Graph API Exploration (optional) - nicht implementiert (zu hoher Aufwand)
- [x] **RISIKO-BESTÄTIGUNG:** ToS-Warnung in SettingsPage UI ✅

**Implementiert (70%):**
- `src/fetchers/facebook.ts` - Vollständiger Fetcher mit Video-Download + OG-Fallback
- `src/middleware/facebook-rate-limit.ts` - Rate Limiting (1 Request/Minute)
- `src/api-react.ts` - /api/v1/facebook/status + /api/v1/facebook/cookies Endpoints
- `frontend/src/components/SettingsPage.tsx` - ToS-Warnung + Cookie-Upload UI
- `test/unit/facebook.test.ts` - 31 Unit-Tests ✅
- `test/unit/facebook-rate-limit.test.ts` - 5 Tests ✅