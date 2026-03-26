# Implementierte Features — Test-Status

## Phase 3c: Dictionary + Einkaufsliste (implementiert, nicht vollständig getestet)

### Backend
| Feature | Datei | Status |
|---------|-------|--------|
| `ingredient_dictionary` Tabelle | `src/schema.ts` | ✅ Migration |
| `shopping_list` Tabelle | `src/schema.ts` | ✅ Migration |
| `extractIngredientName()` | `src/ingredient-dictionary.ts` | ✅ |
| `isSimilar()` mit Levenshtein | `src/ingredient-dictionary.ts` | ✅ |
| Dictionary CRUD (db) | `src/db-react.ts` | ✅ |
| Shopping List CRUD (db) | `src/db-react.ts` | ✅ |
| `/api/v1/shopping` Endpoints | `src/api-react.ts` | ✅ |
| `/api/v1/dictionary` Endpoints | `src/api-react.ts` | ✅ |
| Ingredient-Suche (`?ingredients=`) | `src/api-react.ts`, `src/db-react.ts` | ✅ |

### Frontend
| Feature | Datei | Status |
|---------|-------|--------|
| `ShoppingPage` Komponente | `frontend/src/components/ShoppingPage.tsx` | ✅ |
| Einkauf-Nav-Link | `frontend/src/components/Layout.tsx` | ✅ |
| "Einkauf" Button in RecipeDetail | `frontend/src/components/RecipeDetail.tsx` | ✅ |
| "Aus Rezept hinzufügen" Modal | `ShoppingPage.tsx` | ✅ |
| Abhaken/Löschen/Erledigte löschen | `ShoppingPage.tsx` | ✅ |
| Clipboard-Export | `ShoppingPage.tsx` | ✅ |
| API Services erweitert | `frontend/src/api/services.ts` | ✅ |
| `extractIngredientName()` in frontend | `frontend/src/utils/scaling.ts` | ✅ |

---

## Phase 4: Share + Smart (implementiert, nicht vollständig getestet)

### Backend
| Feature | Datei | Status |
|---------|-------|--------|
| Zutaten-Suche OR-Logik | `src/db-react.ts` | ✅ |
| `/api/v1/recipes?ingredients=` | `src/api-react.ts` | ✅ |

### Frontend
| Feature | Datei | Status |
|---------|-------|--------|
| Zutaten-Suchfeld in RecipeList | `frontend/src/components/RecipeList.tsx` | ✅ |
| PDF-Export mit jsPDF | `frontend/src/utils/pdf-export.ts` | ✅ |
| QR-Code Generierung | `pdf-export.ts` | ✅ |
| "PDF" Button in RecipeDetail | `frontend/src/components/RecipeDetail.tsx` | ✅ |

---

## Bekannte Test-Lücken

1. **Einkaufsliste:**
   - [ ] Einkaufsliste laden via API
   - [ ] "Aus Rezept hinzufügen" — funktioniert der Flow?
   - [ ] Zutaten-Suche matcht korrekt mit Dictionary?

2. **Dictionary:**
   - [ ] Keine UI zum Anzeigen/Verwalten des Dictionaries
   - [ ] Matching via `/api/v1/dictionary/match` nicht getestet

3. **Zutaten-Suche:**
   - [ ] Suche nach "ei" → Rezepte mit "Ei" oder "Eier"
   - [ ] Mehrere Suchbegriffe (OR-Logik)

4. **PDF-Export:**
   - [ ] PDF-Download bei Rezepten ohne source_url
   - [ ] QR-Code wird korrekt generiert
   - [ ] Umlaute/Sonderzeichen in Rezepten

---

## Durchgeführte Tests

- ✅ `npm run build:react` — erfolgreich
- ✅ `npx tsc --noEmit` — TypeScript fehlerfrei
- ✅ `npm test -- --run --exclude="test/e2e/**"` — 120 Unit-Tests bestehen
- ❌ E2E-Tests — nicht ausgeführt (Server muss laufen)