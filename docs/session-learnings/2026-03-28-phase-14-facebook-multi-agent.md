# Session Learning: Phase 14 Facebook Import mit Multi-Agent

**Datum:** 2026-03-28  
**Session-Typ:** Feature-Implementation mit mehreren parallelen Agents  
**Branch:** `phase/14-facebook-import`

---

## Was gemacht wurde

| Phase | Agent | Ergebnis |
|-------|-------|----------|
| Phase 1 | Agent 1 | ✅ Facebook Fetcher (yt-dlp video + OG fallback) |
| Phase 1 | Agent 2 | ❌ Keine Änderungen (Task-Problem) |
| Phase 1 | Agent 3 | ✅ 30 Unit Tests |
| Phase 2 | Agent 1 | ✅ Cookie-Management Backend |
| Phase 2 | Agent 2 | ❌ Keine Änderungen |
| Phase 2 | Agent 3 | ✅ Rate-Limit Middleware + Tests |
| Phase 2 | Manuel | ✅ Frontend UI (SettingsPage) |

**Endergebnis:** Phase 14 @ 80% abgeschlossen

---

## Patterns Discovered

### Pattern: Multi-Agent Orchestrierung

**Kontext:** Wenn ein Feature in mehrere unabhängige Komponenten aufgeteilt werden kann (Backend, Frontend, Tests)

**Implementation:**
- Ein Agent pro technischer Schicht (Backend, Frontend, Tests)
- Agent 1 → Backend (fetcher, API)
- Agent 2 → Frontend (React Components)
- Agent 3 → Tests (Unit/E2E)

**Beispiel:**
```typescript
// 3 parallele Agents starten - jeder für eine Schicht
task(subagent_type="general", prompt="Backend...")
task(subagent_type="webdev", prompt="Frontend...")
task(subagent_type="tdd-guide", prompt="Tests...")
```

### Pattern: Nie wiederverwendete Task-IDs

**Kontext:** Wenn ein Agent in einem früheren Versuch nichts gemacht hat

**Implementation:**
```typescript
// ❌ FALSCH - alter Task der nichts gemacht hat
task(task_id: "ses_2c9a675bbffeq9zgEQlagnc1O8", ...)

// ✅ RICHTIG - komplett neuer Agent
task(description="...", prompt="...", subagent_type="...")
```

---

## Best Practices Applied

### 1. Regelmäßige Status-Checks

**Warum:** Agent 2 hat zweimal nichts gemacht, aber ich habe zu spät geprüft

**Wann:** Nach jedem Agent-Start `git status` und `git diff --stat` ausführen

```bash
# Nach jedem Agent
git status && git diff --stat

# Oder parallel
bash: git status
bash: npm test
```

### 2. Manuel fallback wenn Agent versagt

**Warum:** Agent 2 hat 2x nicht funktioniert - ich habe dann selbst das Frontend implementiert

**Wann:** Wenn nach 30-60 Sekunden keine Änderungen in git sichtbar sind

### 3. Commit nach jedem Sub-Task

**Warum:** Macht den Fortschritt sichtbar und ermöglicht Rollback

```bash
git add -A && git commit -m "feat(facebook): phase 14 phase 1 - video-only import"
```

---

## Mistakes to Avoid

### 1. Task-ID von fehlgeschlagenen Agents wiederverwenden

**Was schiefging:** Ich habe `task_id: ses_2c9a675bbffeq9zgEQlagnc1O8` wiederholt - der Task war aber von Anfang an "leer"

**Wie zu verhindern:**
- Niemals `task_id` setzen wenn der vorherige Agent nichts produziert hat
- Stattdessen: komplett neuen Agent starten mit neuem Prompt
- Bei "Tool execution aborted": neuen Agent ohne ID starten

### 2. Zu viele Agents auf einmal starten ohne Überwachung

**Was schiefging:** 3 Agents parallel, aber nur 2 haben funktioniert

**Wie zu verhindern:**
- Nach dem Start 30 Sekunden warten
- `git status` prüfen ob Dateien geändert wurden
- Bei Agent-Ausfall: anderen Agent für diese Schicht starten

### 3. Frontend ohne API-Services implementieren

**Was schiefging:** Agent 2 sollte beides machen (API + UI), hat aber nichts gemacht

**Wie zu verhindern:**
- Klare Trennung: Agent 1 = Backend+API, Agent 2 = nur Frontend-UI
- API-Services in separater Datei (`services.ts`) vorbereiten
- Oder: 2 Frontend-Agents (einer für API, einer für UI)

---

## Reusable Snippets

### Facebook Fetcher Struktur (Backend)

```typescript
// src/fetchers/facebook.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const execFileAsync = promisify(execFile);
const COOKIE_PATH = join(process.cwd(), "data", "facebook-cookies.txt");

export function isFacebookVideoUrl(url: string): boolean {
  const videoPatterns = [
    /facebook\.com\/.*\/videos\//i,
    /facebook\.com\/video\.php/i,
    /facebook\.com\/watch\/?\?/i,
    /fb\.watch\//i,
    /facebook\.com\/reel\//i,
  ];
  return videoPatterns.some((pattern) => pattern.test(url));
}

// Retry mit Exponential Backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}
```

### Cookie-Management (API)

```typescript
// src/api-react.ts - Cookie Endpoints
app.get("/api/v1/facebook/status", (c) => {
  const hasCookies = existsSync(COOKIE_PATH);
  return c.json({ hasCookies });
});

app.post("/api/v1/facebook/cookies", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("cookies");
  const content = await file.text();
  
  // Validierung...
  validateFacebookCookies(content);
  
  writeFileSync(COOKIE_PATH, content);
  return c.json({ success: true });
});
```

### Rate-Limit Middleware

```typescript
// src/middleware/facebook-rate-limit.ts
const rateLimitStore = new Map<string, { lastRequest: number; blockedUntil: number }>();

export function checkRateLimit(ip: string, windowMs: number = 60_000): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { lastRequest: now, blockedUntil: 0 };
  
  if (now < entry.blockedUntil) {
    return { allowed: false, retryAfterMs: entry.blockedUntil - now };
  }
  
  if (now - entry.lastRequest < windowMs) {
    entry.blockedUntil = now + windowMs;
    return { allowed: false, retryAfterMs: windowMs };
  }
  
  entry.lastRequest = now;
  entry.blockedUntil = 0;
  return { allowed: true, retryAfterMs: 0 };
}
```

---

## Suggested Skill Updates

### `skills/coding-standards/SKILL.md`

**Neuer Abschnitt "Multi-Agent Orchestrierung":**

```markdown
## Multi-Agent Workflows

### Regeln:
1. Max 3 parallele Agents pro Feature
2. Nach jedem Agent: `git status` prüfen
3. Niemals `task_id` wiederverwenden wenn vorheriger Agent nichts gemacht hat
4. Manuel fallback wenn Agent versagt

### Typische Aufteilung:
- Agent 1: Backend/API
- Agent 2: Frontend/UI
- Agent 3: Tests/Dokumentation
```

---

## Instinct Format

```json
{
  "trigger": "Agent reagiert nicht innerhalb von 30 Sekunden",
  "action": "Nie task_id wiederverwenden. Stattdessen: git status prüfen, dann neuen Agent ohne ID starten oder selbst implementieren",
  "confidence": 0.9,
  "source": "session-extraction",
  "timestamp": "2026-03-28T22:55:00Z"
}
```

```json
{
  "trigger": "Multi-Agent Feature-Implementation starten",
  "action": "Max 3 Agents: Backend, Frontend, Tests. Nach jedem Agent git status prüfen.",
  "confidence": 0.85,
  "source": "session-extraction",
  "timestamp": "2026-03-28T22:55:00Z"
}
```

---

## Verwandte Sessions

- [Phase 13 Pinterest Import](./2026-03-28-pinterest-import.md) - Ähnliche Multi-Agent Struktur
- [Phase 12 TikTok](./2026-03-27-tiktok-verbesserung.md) - E2E Tests Pattern
