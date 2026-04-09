---
status: PLANNING
last_reviewed: 2026-03-28
feature: Pinterest Import (0% → 100%)
priority: 5
phase: 13
branch: phase/13-pinterest-import
---

# Plan: Pinterest-Integration

## Ziel

Pinterest-Pins mit Rezepten zuverlässig extrahieren und importieren.

---

## Aktuelle Situation (0%)

### Platzhalter-Status ❌
```typescript
// src/fetchers/pinterest.ts
export async function fetchPinterest(_url: string): Promise<ContentBundle> {
  throw new Error(
    "Pinterest-Import ist noch nicht implementiert. Bitte nutze vorerst die URL-Extraktion über den Web-Importer."
  );
}
```

### Vorbereitet ✅
1. **Klassifizierung:** `classifier.ts` erkennt Pinterest URLs
2. **Pipeline:** `case "pinterest":` existiert
3. **Types:** `SourceType` enthält "pinterest"
4. **Infrastruktur:** BYOK, Job-Manager, Cheerio, yt-dlp

---

## Herausforderungen

### **Technische Hürden:**
1. **Anti-Scraping:** Pinterest blockiert Bots mit 403 Forbidden
2. **JavaScript-Rendering:** Pin-Seiten sind SPAs (Client-side)
3. **API OAuth 2.0:** Pinterest API erfordert App-Registrierung
4. **Rate Limits:** Unbekannt, potentiell restriktiv

### **Content-Probleme:**
1. **Rezepte verlinkt:** Meist auf externe Seiten, nicht im Pin selbst
2. **Kurze Beschreibungen:** Oft nur Titel + kurze Notiz
3. **Copyright:** Pins verweisen auf Original-Inhalte
4. **Bild-Qualität:** Pin-Bilder können Wasserzeichen/Overlays haben

---

## Implementierungs-Phasen

### Phase 1: Minimal Viable Fetcher (→ 50%) - 2 Tage

**Proxy-Ansatz:** Pinterest als URL-Router nutzen

```typescript
async function fetchPinterest(url: string): Promise<ContentBundle> {
  // 1. HTML mit User-Agent laden
  const html = await fetchHTMLWithUserAgent(url);
  const $ = cheerio.load(html);
  
  // 2. Open Graph Metadata extrahieren
  const title = $('meta[property="og:title"]').attr('content') || '';
  const description = $('meta[property="og:description"]').attr('content') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';
  
  // 3. Original-URL finden
  const originalUrl = findOriginalUrl($);
  
  // 4. Falls Original-URL: Web-Fetcher aufrufen
  if (originalUrl) {
    return await fetchWeb(originalUrl, tempDir);
  }
  
  // 5. Sonst: Limited Content mit Pin-Daten
  return {
    url,
    type: "pinterest",
    title,
    description,
    textContent: description,
    imageUrls: image ? [image] : [],
    audioPath: undefined,
    schemaRecipe: null
  };
}
```

**Original-URL Detection:**
```typescript
function findOriginalUrl($: cheerio.CheerioAPI): string | null {
  // Pinterest HTML Struktur
  const selectors = [
    'a[data-test-id="pin-carousel-original-link"]',
    'a[href*="://"][rel~="noopener"]',
    'a[href^="http"]:not([href*="pinterest.com"])',
    'meta[property="og:see_also"]'
  ];
  
  for (const selector of selectors) {
    const url = $(selector).attr('href');
    if (url && !url.includes('pinterest.com')) {
      return url;
    }
  }
  
  return null;
}
```

### Phase 2: Verbesserte Extraktion (→ 70%) - 3 Tage

**1. Bild-Download mit yt-dlp:**
```typescript
// Pinterest-Bilder extrahieren
try {
  await execFileAsync("yt-dlp", [
    "--write-thumbnail",
    "--skip-download",  // Nur Metadata
    "-o", join(tempDir, "pinterest"),
    url
  ]);
} catch {
  // Fallback: Open Graph image
}
```

**2. Pin-Beschreibungs-Analyse:**
```typescript
function analyzePinDescription(description: string): string {
  // Erkenne Rezept-Indikatoren
  const recipeKeywords = ["Zutaten:", "Rezept:", "Zubereitung:", "Zeit:"];
  const hasRecipeContent = recipeKeywords.some(keyword => 
    description.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (hasRecipeContent) {
    // LLM-Extraktion versuchen
    return await extractRecipeFromText(description);
  }
  
  return description;
}
```

**3. Multi-Bild Support:**
- Carousel-Pins erkennen
- Alle Bilder im Carousel extrahieren
- `imageUrls` Array mit allen Bildern

**4. User-Agent Rotation:**
- Verschiedene Browser-User-Agents
- Cookie-Handling für Session
- Rate-Limit Vermeidung

### Phase 3: Pinterest API Integration (→ 90%) - 4 Tage

**1. BYOK für Pinterest API:**
```typescript
// SettingsPage erweitern für Pinterest API Keys
interface PinterestCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
}
```

**2. OAuth 2.0 Flow:**
```
1. Pinterest Developer App registrieren
2. OAuth Redirect URI konfigurieren
3. Access Token erhalten (user authorization)
4. API Calls mit Bearer Token
```

**3. API Endpoints nutzen:**
```typescript
// v5 API: https://developers.pinterest.com/docs/api/v5/
GET /v5/pins/{pin_id}
GET /v5/pins/{pin_id}/comments
GET /v5/boards/{board_id}/pins
```

**4. Rate-Limit Management:**
- Exponential Backoff bei 429
- Quota-Tracking
- Fallback zu Web-Scraping wenn API limitiert

### Phase 4: Vollständige Integration (→ 100%) - 2 Tage

**1. Vision Model für Bild-OCR:**
- Falls Pin nur Bild ohne Text
- Groq Llama 4 Scout für Text-in-Bildern
- Kombination von Bild-OCR und Pin-Metadaten

**2. Kommentar-Extraktion:**
- Pinterest-Kommentare für Rezeptdetails
- Nur für öffentliche Pins verfügbar

**3. Board-Support:**
- Ganze Pinterest-Boards durchsuchen
- Batch-Verarbeitung von Pins
- Filter für Rezept-Pins

**4. Testing & Robustheit:**
- E2E Tests mit echten Pinterest-URLs
- Error-Handling für verschiedene Fehler-Szenarien
- Fallback-Kette: API → Web → Limited

---

## Technische Details

### Pin-Struktur Analyse

**Typischer Rezept-Pin:**
- **Titel:** "Schnelles Abendessen"
- **Beschreibung:** "Perfektes Rezept für unter der Woche..."
- **Bild:** Hochauflösendes Foto vom Gericht
- **Original-URL:** Link zu Chefkoch/Blog/etc.
- **Kommentare:** "Habe mit XYZ ausprobiert..."

**Rezept im Pin (selten):**
- **Zutaten:** In Beschreibung als Liste
- **Schritte:** In Kommentaren oder Bild-Overlay
- **Zeitangaben:** "15 min Vorbereitung"

### Proxy-Fetcher Flow

```
Pinterest URL → fetchPinterest()
├── Open Graph Metadata extrahieren
├── Original-URL suchen
├── Falls Original-URL: fetchWeb() → Rezept
└── Falls keine Original-URL: Limited Content
    ├── Pin-Beschreibung analysieren
    ├── Bild extrahieren  
    └── LLM-Extraktion falls Rezept-Inhalt
```

### API vs. Web-Scraping Trade-off

| Feature | Web-Scraping | API |
|---------|--------------|-----|
| **Zugriff** | 403 Forbidden risk | ✅ Authentifiziert |
| **Rate Limits** | Unklar, schnell blockiert | ✅ Dokumentiert |
| **Daten-Tiefe** | Limited (Open Graph) | ✅ Vollständig |
| **Implementierung** | Einfach | 🟡 Komplex (OAuth) |
| **Wartung** | Hoch (Anti-Scraping) | 🟡 Mittel (API-Changes) |

---

## Risiko-Analyse

| Risiko | Level | Mitigation |
|--------|-------|------------|
| Anti-Scraping Blocks | HIGH | User-Agent Rotation, Rate Limiting |
| API OAuth Komplexität | MEDIUM | Schrittweise Implementierung |
| Original-URL Detection | MEDIUM | Mehrere Selektoren, Fallbacks |
| Copyright Issues | MEDIUM | Nur öffentliche Inhalte, Attribution |

---

## Erfolgskriterien

- [ ] **Phase 1:** Original-URL Detection funktioniert für 80% der Pins
- [ ] **Phase 2:** Pin-Bilder werden zuverlässig extrahiert
- [ ] **Phase 3:** Pinterest API Integration optional verfügbar
- [ ] **Phase 4:** Bild-OCR für textlose Rezept-Pins
- [ ] **Gesamt:** >90% der Pinterest-Rezepte importierbar

---

## Geschätzter Aufwand

**11 Tage** (~2.5 Wochen)

- Phase 1: 2 Tage (Proxy-Fetcher)
- Phase 2: 3 Tage (Verbesserte Extraktion)
- Phase 3: 4 Tage (API Integration)
- Phase 4: 2 Tage (Vollständige Integration)

---

## Verwandte Dateien

| Datei | Änderung |
|-------|----------|
| `src/fetchers/pinterest.ts` | Vollständige Implementierung |
| `frontend/src/components/SettingsPage.tsx` | Pinterest API Keys |
| `src/api-react.ts` | Pinterest OAuth Endpoints |
| `test/unit/pinterest.test.ts` | **NEU** |
| `src/fetchers/web.ts` | Original-URL Weiterleitung |

---

## Abhängigkeiten

1. **Pinterest Developer Account:** Für API Zugriff (optional)
2. **Cheerio:** Web-Scraping
3. **yt-dlp:** Bild-Download
4. **Groq Vision API:** Für Bild-OCR (optional)
5. **OAuth 2.0 Library:** Für API Authentifizierung

---

## Offene Fragen

1. **OAuth Implementierung:** Sollen Benutzer eigene Pinterest API Keys verwenden?
2. **Rate Limits:** Wie viele Pins pro Tag können gescrapt werden?
3. **Legal:** Ist Scraping von Pinterest erlaubt?
4. **User Experience:** Sollen Nutzer zwischen Web/API wählen können?

---

## Fortschritt

- [ ] Phase 1: Minimal Viable Fetcher (Proxy)
- [ ] Phase 2: Verbesserte Extraktion  
- [ ] Phase 3: Pinterest API Integration
- [ ] Phase 4: Vollständige Integration