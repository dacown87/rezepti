# Komponenten & Versionen

**Letzter Check:** 25.03.2026

## Backend (Root package.json)

### Dependencies
| Package | Version | Status |
|---------|---------|--------|
| @hono/node-server | 1.14.0 | ✅ OK |
| better-sqlite3 | 12.8.0 | ✅ OK (aktualisiert) |
| cheerio | 1.0.0 | ✅ OK |
| concurrently | 9.2.1 | ✅ OK |
| dotenv | 17.3.1 | ✅ OK (aktualisiert) |
| drizzle-orm | 0.45.1 | ✅ OK (aktualisiert) |
| hono | 4.12.9 | ✅ OK |
| lucide-react | 1.6.0 | ✅ OK (aktualisiert) |
| openai | 6.32.0 | ✅ OK (aktualisiert) |
| react | 19.2.4 | ✅ OK (aktualisiert) |
| react-dom | 19.2.4 | ✅ OK (aktualisiert) |
| react-router-dom | 7.13.2 | ✅ OK (aktualisiert) |
| zod | 4.3.6 | ✅ OK (aktualisiert) |

### DevDependencies
| Package | Version | Status |
|---------|---------|--------|
| @tailwindcss/postcss | 4.2.2 | ✅ OK |
| @tailwindcss/vite | 4.2.2 | ✅ OK |
| @testing-library/jest-dom | 6.2.0 | ✅ OK |
| @testing-library/react | 16.2.0 | ✅ OK (aktualisiert) |
| @types/better-sqlite3 | 7.6.0 | ✅ OK |
| @types/node | 25.5.0 | ✅ OK (aktualisiert) |
| @types/react | 19.2.14 | ✅ OK (aktualisiert) |
| @types/react-dom | 19.2.3 | ✅ OK (aktualisiert) |
| @vitejs/plugin-react | 6.0.1 | ✅ OK (vitest inkompatibel) |
| @vitest/ui | 3.2.4 | ✅ OK (aktualisiert) |
| autoprefixer | 10.4.27 | ✅ OK |
| drizzle-kit | 0.31.10 | ✅ OK (aktualisiert) |
| happy-dom | 20.8.8 | ✅ OK (aktualisiert) |
| jsdom | 29.0.1 | ✅ OK |
| postcss | 8.5.8 | ✅ OK |
| tailwindcss | 4.2.2 | ✅ OK |
| tsx | 4.21.0 | ✅ OK |
| typescript | 6.0.2 | ✅ OK (aktualisiert) |
| vite | 8.0.2 | ✅ OK (aktualisiert) |
| vitest | 3.2.4 | ✅ OK (aktualisiert) |

## Frontend (frontend/package.json)

> Hinweis: Frontend verwendet die node_modules aus dem Root-Projekt

### Dependencies (aus Root)
| Package | Version |
|---------|---------|
| lucide-react | 1.6.0 ✅ |
| react | 18.3.1 🔴 |
| react-dom | 18.3.1 🔴 |
| react-router-dom | 6.30.3 🔴 |

## Docker Images
| Image | Version |
|-------|---------|
| node | 22-alpine (Dockerfile) |
| node | 22-slim (Dockerfile.react) |

## Externe APIs
| Service | API |
|---------|-----|
| Groq | https://api.groq.com/openai/v1/chat/completions |
| OpenAI | https://api.openai.com/v1/chat/completions |

## Zusammenfassung

### ✅ Abgeschlossen
- **Runde 1 (niedrig):** dotenv, happy-dom, lucide-react, zod
- **Runde 2 (mittel):** @types/node, typescript
- **Runde 3 (mittel):** vite, @vitejs/plugin-react, drizzle-orm, drizzle-kit
- **Runde 4 (einzeln):** @types/react, @types/react-dom, react, react-dom, react-router-dom, openai
- **Runde 5:** @testing-library/react 14→16, better-sqlite3 9→11 (Downgrade für vitest)

### ✅ Alle Updates abgeschlossen
- **better-sqlite3:** 11.10.0 → 12.8.0 ✅
- **vitest:** 1.6.1 → 3.2.4 ✅
- **@vitest/ui:** 1.6.1 → 3.2.4 ✅

### Optional (funktioniert aber nicht getestet)
| Package | Current | Latest |
|---------|---------|--------|
| vitest | 3.2.4 | 4.1.1 |
