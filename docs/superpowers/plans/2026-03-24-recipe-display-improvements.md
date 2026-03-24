# Recipe Display Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve recipe display with a prominent source link, Dr. Oetker-style 2-column layout, and serving size scaling.

**Architecture:** All changes are frontend-only (React components). No backend or API changes needed. Serving size scaling is pure in-component state — parse the numeric portion from the stored `servings` string, use a +/- stepper, scale ingredient quantities via regex.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

---

## Status Audit (before starting)

- Item 1 (Original-Link): **Partially done** — `source_url` shown in "Quelle"-box at bottom of `RecipeDetail.tsx:221-238`. Missing: prominent "Zum Original" button in the action area at top.
- Item 2 (Zutaten & Schritte getrennt): **UI partially done** — separate sections exist but single-column layout. Missing: side-by-side 2-column layout on desktop (md+).
- Item 3 (Eigene Seite statt Modal): **Already done** — `/recipe/:id` route exists in `App.tsx:15`. No work needed.
- Item 4 (Portionsgröße skalieren): **Not implemented** — needs UI stepper + scaling logic.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/components/RecipeDetail.tsx` | Modify | All visual changes: link button, 2-col layout, serving scaler |
| `frontend/src/utils/scaling.ts` | Create | Pure functions: parse servings number, scale ingredient quantities |
| `frontend/src/utils/scaling.test.ts` | Create | Unit tests for scaling logic |
| `frontend/src/components/RecipeDetail.test.tsx` | Modify | Add tests for new UI behaviors |

---

## Task A: Prominent "Zum Original" button

**Files:**
- Modify: `frontend/src/components/RecipeDetail.tsx:173-186`

- [ ] **Step 1: Add ExternalLink import**

In `RecipeDetail.tsx` line 3, add `ExternalLink` to lucide-react import:
```tsx
import { ArrowLeft, Clock, Users, Flame, Edit, Trash2, ChefHat, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
```

- [ ] **Step 2: Add "Zum Original" button in action area**

In `RecipeDetail.tsx`, in the action buttons div (after the delete button, around line 186), add a conditional link:
```tsx
{recipe.source_url && (
  <a
    href={recipe.source_url}
    target="_blank"
    rel="noopener noreferrer"
    className="px-4 py-3 border border-warmgray/20 text-warmgray rounded-lg font-medium hover:bg-warmgray/5 transition-colors flex items-center space-x-2"
    title="Original-Rezept öffnen"
  >
    <ExternalLink size={20} />
    <span className="hidden sm:inline">Zum Original</span>
  </a>
)}
```

- [ ] **Step 3: Keep or remove the "Quelle"-box at bottom**

The redundant "Quelle"-box at line 221-238 can be kept as-is — it shows the extracted date too which is useful.

- [ ] **Step 4: Build and visually verify**

```bash
npm run build:react
```
Open browser and verify the "Zum Original" button appears next to Edit/Delete.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RecipeDetail.tsx
git commit -m "feat: add prominent source link button to recipe detail actions"
```

---

## Task B: Dr. Oetker 2-column layout (Zutaten | Zubereitung)

**Files:**
- Modify: `frontend/src/components/RecipeDetail.tsx:188-216`

The goal: on `md+` screens, show ingredients and steps side-by-side. On mobile, ingredients first, then steps below (current behavior).

- [ ] **Step 1: Replace single-column with 2-column grid**

Replace the current ingredients + steps section in `RecipeDetail.tsx` (around lines 188–216) with:
```tsx
{/* Ingredients + Steps: 2-column on desktop */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
  {/* Ingredients */}
  <div>
    <h2 className="text-xl font-display font-bold mb-4 pb-2 border-b border-warmgray/10">
      Zutaten
    </h2>
    <ul className="space-y-2">
      {recipe.ingredients.map((ingredient, index) => (
        <li key={index} className="flex items-start space-x-3">
          <div className="w-2 h-2 bg-paprika rounded-full mt-2.5 flex-shrink-0"></div>
          <span className="text-warmgray text-sm">{ingredient}</span>
        </li>
      ))}
    </ul>
  </div>

  {/* Steps */}
  <div>
    <h2 className="text-xl font-display font-bold mb-4 pb-2 border-b border-warmgray/10">
      Zubereitung
    </h2>
    <ol className="space-y-4">
      {recipe.steps.map((step, index) => (
        <li key={index} className="flex space-x-3">
          <div className="flex-shrink-0 w-6 h-6 bg-paprika text-white rounded-full flex items-center justify-center font-bold text-xs">
            {index + 1}
          </div>
          <p className="text-warmgray text-sm pt-0.5">{step}</p>
        </li>
      ))}
    </ol>
  </div>
</div>
```

- [ ] **Step 2: Build and visually verify**

```bash
npm run build:react
```
Check on desktop (md+): ingredients left, steps right. Check on mobile: stacked.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/RecipeDetail.tsx
git commit -m "feat: 2-column layout for ingredients and steps on desktop"
```

---

## Task C: Serving size scaling

**Files:**
- Create: `frontend/src/utils/scaling.ts`
- Create: `frontend/src/utils/scaling.test.ts`
- Modify: `frontend/src/components/RecipeDetail.tsx`

### C1: Scaling utility functions

- [ ] **Step 1: Write failing tests first**

Create `frontend/src/utils/scaling.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseServingsNumber, scaleIngredient } from './scaling.js'

describe('parseServingsNumber', () => {
  it('extracts number from "4 Portionen"', () => {
    expect(parseServingsNumber('4 Portionen')).toBe(4)
  })
  it('extracts number from "2 Personen"', () => {
    expect(parseServingsNumber('2 Personen')).toBe(2)
  })
  it('returns 4 as default for unrecognized strings', () => {
    expect(parseServingsNumber('für viele')).toBe(4)
  })
  it('handles plain number string "6"', () => {
    expect(parseServingsNumber('6')).toBe(6)
  })
})

describe('scaleIngredient', () => {
  it('scales "200g Mehl" by 2x', () => {
    expect(scaleIngredient('200g Mehl', 2)).toBe('400g Mehl')
  })
  it('scales "2 EL Öl" by 0.5x', () => {
    expect(scaleIngredient('2 EL Öl', 0.5)).toBe('1 EL Öl')
  })
  it('scales "1 Prise Salz" — leaves non-scalable as-is', () => {
    expect(scaleIngredient('1 Prise Salz', 2)).toBe('2 Prise Salz')
  })
  it('returns ingredient unchanged when no number found', () => {
    expect(scaleIngredient('Salz nach Geschmack', 2)).toBe('Salz nach Geschmack')
  })
  it('rounds to 1 decimal place', () => {
    expect(scaleIngredient('100g Butter', 3)).toBe('300g Butter')
  })
  it('removes trailing .0 decimals', () => {
    expect(scaleIngredient('100g Mehl', 2)).toBe('200g Mehl')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --run frontend/src/utils/scaling.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement scaling utilities**

Create `frontend/src/utils/scaling.ts`:
```typescript
/**
 * Parses the numeric serving count from a servings string.
 * Examples: "4 Portionen" → 4, "2 Personen" → 2, "6" → 6
 * Returns 4 as default if no number is found.
 */
export function parseServingsNumber(servings: string): number {
  const match = servings.match(/\d+/)
  if (!match) return 4
  return parseInt(match[0], 10)
}

/**
 * Scales all leading numbers in an ingredient string by the given factor.
 * Example: scaleIngredient("200g Mehl", 2) → "400g Mehl"
 * Leaves strings without numbers unchanged.
 */
export function scaleIngredient(ingredient: string, factor: number): string {
  return ingredient.replace(/^(\d+(?:[.,]\d+)?)/, (match) => {
    const num = parseFloat(match.replace(',', '.')) * factor
    const rounded = Math.round(num * 10) / 10
    // JavaScript's String() already strips trailing .0 (e.g. String(300.0) → "300")
    return String(rounded)
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --run frontend/src/utils/scaling.test.ts
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/scaling.ts frontend/src/utils/scaling.test.ts
git commit -m "feat: add ingredient scaling utility functions with tests"
```

### C2: Serving size UI in RecipeDetail

- [ ] **Step 6: Add serving state and scaling to RecipeDetail**

At the top of `RecipeDetail.tsx`, add the import:
```tsx
import { parseServingsNumber, scaleIngredient } from '../utils/scaling.js'
```

After `const [isDeleting, setIsDeleting]` state line, add:
```tsx
const [servingMultiplier, setServingMultiplier] = useState(1)
```

- [ ] **Step 7: Add serving size UI in the stats grid**

Replace the current "Portionen" stat block (the `<div>` containing the `Users` icon, around line 155–161) with:
```tsx
<div className="text-center p-4 bg-cream rounded-xl">
  <div className="flex items-center justify-center space-x-2 text-warmgray mb-2">
    <Users size={20} />
    <span className="font-medium">
      {Math.round(parseServingsNumber(recipe.servings) * servingMultiplier)}{' '}
      {recipe.servings.replace(/^\d+\s*/, '') || 'Portionen'}
    </span>
  </div>
  <div className="text-sm text-warmgray mb-2">Portionen</div>
  <div className="flex items-center justify-center space-x-2">
    <button
      onClick={() => setServingMultiplier(m => Math.max(0.5, m - 0.5))}
      disabled={servingMultiplier <= 0.5}
      className="w-6 h-6 bg-paprika text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-paprika-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      −
    </button>
    <span className="text-xs text-warmgray w-8 text-center">
      {servingMultiplier === 1 ? 'Normal' : `×${servingMultiplier}`}
    </span>
    <button
      onClick={() => setServingMultiplier(m => Math.min(4, m + 0.5))}
      disabled={servingMultiplier >= 4}
      className="w-6 h-6 bg-paprika text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-paprika-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      +
    </button>
  </div>
</div>
```

- [ ] **Step 8: Apply scaling to ingredient list**

In the ingredient list (the `.map` over `recipe.ingredients`), change `{ingredient}` to:
```tsx
{servingMultiplier === 1 ? ingredient : scaleIngredient(ingredient, servingMultiplier)}
```

- [ ] **Step 9: Add visual indicator when scaled**

Above the ingredients section heading, add:
```tsx
{servingMultiplier !== 1 && (
  <div className="mb-2 text-xs text-paprika font-medium flex items-center space-x-1">
    <span>Zutaten für ×{servingMultiplier} skaliert</span>
    <button onClick={() => setServingMultiplier(1)} className="underline hover:no-underline">Zurücksetzen</button>
  </div>
)}
```

- [ ] **Step 10: Add UI tests for serving scaler in RecipeDetail.test.tsx**

In `frontend/src/components/RecipeDetail.test.tsx`, add a new describe block (import `fireEvent` from `@testing-library/react` if not already imported):

```typescript
describe('serving size scaler', () => {
  it('shows +/- buttons and "Normal" label by default', async () => {
    renderWithProviders(<RecipeDetail />, { route: '/recipe/1' })
    await waitFor(() => expect(screen.queryByText('Lade...')).not.toBeInTheDocument())
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('−')).toBeInTheDocument()
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('updates serving count and shows multiplier after clicking +', async () => {
    renderWithProviders(<RecipeDetail />, { route: '/recipe/1' })
    await waitFor(() => expect(screen.queryByText('Lade...')).not.toBeInTheDocument())
    fireEvent.click(screen.getByText('+'))
    expect(screen.getByText('×1.5')).toBeInTheDocument()
  })

  it('shows scaling banner when multiplier is not 1', async () => {
    renderWithProviders(<RecipeDetail />, { route: '/recipe/1' })
    await waitFor(() => expect(screen.queryByText('Lade...')).not.toBeInTheDocument())
    fireEvent.click(screen.getByText('+'))
    expect(screen.getByText(/skaliert/)).toBeInTheDocument()
  })

  it('resets multiplier to 1 when Zurücksetzen is clicked', async () => {
    renderWithProviders(<RecipeDetail />, { route: '/recipe/1' })
    await waitFor(() => expect(screen.queryByText('Lade...')).not.toBeInTheDocument())
    fireEvent.click(screen.getByText('+'))
    fireEvent.click(screen.getByText('Zurücksetzen'))
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.queryByText(/skaliert/)).not.toBeInTheDocument()
  })
})
```

Note: `servingMultiplier` is local component state — it resets to 1 on navigation (intentional: the user starts fresh each time they open a recipe).

- [ ] **Step 11: Build and visually verify**

```bash
npm run build:react
```
Open a recipe in browser. Verify:
- +/− buttons in Portionen tile change the count
- Ingredient amounts scale accordingly
- "Zutaten für ×2 skaliert" banner appears
- "Zurücksetzen" resets to ×1

- [ ] **Step 12: Build and run tests**

```bash
npm run build:react && npm test -- --run frontend/src/components/RecipeDetail.test.tsx frontend/src/utils/scaling.test.ts
```
Expected: All PASS

- [ ] **Step 13: Commit**

```bash
git add frontend/src/components/RecipeDetail.tsx frontend/src/components/RecipeDetail.test.tsx
git commit -m "feat: add serving size scaler with ingredient scaling in recipe detail"
```

---

## Task D: Update CLAUDE.md roadmap

- [ ] **Step 1: Update roadmap percentages**

In `CLAUDE.md`, update the Roadmap section:
- `Original recipe link: 0%` → `Original recipe link: 100% ✅`
- `Recipe as separate page (not modal): 0%` → `Recipe as separate page (not modal): 100% ✅ — already implemented via /recipe/:id route`
- `Ingredients & steps displayed separately (à la Dr. Oetker): 20%` → `Ingredients & steps displayed separately (à la Dr. Oetker): 90% ✅ — 2-column layout on desktop`
- `Adjustable serving size + scaling: 0%` → `Adjustable serving size + scaling: 80% ✅ — ×0.5–×4 stepper, ingredient quantity scaling`

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update roadmap status for recipe display improvements"
```
