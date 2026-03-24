# Ingredient-Based Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users fix one ingredient's quantity to scale the entire recipe proportionally, with a reset button to restore defaults.

**Architecture:** Two new utility functions (`parseIngredientNumber`, `splitIngredient`) extend `scaling.ts`. `RecipeDetail` gets two new state variables (`editingIngredientIndex`, `editingValue`) and a reworked ingredient list that shows pencil icons and inline number inputs. The existing `servingMultiplier` state drives all display logic unchanged.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-ingredient-scaling-design.md`

---

## File Map

| File | Change |
|---|---|
| `frontend/src/utils/scaling.ts` | Add `parseIngredientNumber` and `splitIngredient` |
| `frontend/src/utils/scaling.test.ts` | Add tests for the two new functions |
| `frontend/src/components/RecipeDetail.tsx` | New state, restructured ingredient list, reset button |

---

## Task 1: Add utility functions (TDD)

**Files:**
- Modify: `frontend/src/utils/scaling.ts`
- Modify: `frontend/src/utils/scaling.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `frontend/src/utils/scaling.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseServingsNumber, scaleIngredient, parseIngredientNumber, splitIngredient } from './scaling.js'

// ... existing tests unchanged ...

describe('parseIngredientNumber', () => {
  it('parses leading integer', () => {
    expect(parseIngredientNumber('150g Butter')).toBe(150)
  })
  it('parses leading decimal with dot', () => {
    expect(parseIngredientNumber('1.5 EL Öl')).toBe(1.5)
  })
  it('parses leading decimal with comma', () => {
    expect(parseIngredientNumber('1,5 EL Öl')).toBe(1.5)
  })
  it('returns null when no leading number', () => {
    expect(parseIngredientNumber('Salz nach Geschmack')).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(parseIngredientNumber('')).toBeNull()
  })
})

describe('splitIngredient', () => {
  it('splits "150g Butter" into num and rest', () => {
    expect(splitIngredient('150g Butter')).toEqual({ num: '150', rest: 'g Butter' })
  })
  it('splits "2 EL Öl" into num and rest', () => {
    expect(splitIngredient('2 EL Öl')).toEqual({ num: '2', rest: ' EL Öl' })
  })
  it('splits "1,5 EL Öl" preserving original num string', () => {
    expect(splitIngredient('1,5 EL Öl')).toEqual({ num: '1,5', rest: ' EL Öl' })
  })
  it('returns null when no leading number', () => {
    expect(splitIngredient('Salz nach Geschmack')).toBeNull()
  })
  it('returns null consistently with parseIngredientNumber', () => {
    const ingredient = 'Pfeffer'
    expect(splitIngredient(ingredient)).toBeNull()
    expect(parseIngredientNumber(ingredient)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- --run --reporter=verbose frontend/src/utils/scaling.test.ts
```

Expected: fails with `parseIngredientNumber is not a function` (or similar import error).

- [ ] **Step 3: Implement the two functions**

Add to `frontend/src/utils/scaling.ts`:

```ts
/**
 * Extracts the leading number from an ingredient string.
 * Supports both dot and comma as decimal separator.
 * Returns null if no leading number is found.
 * Examples: "150g Butter" → 150, "1,5 EL Öl" → 1.5, "Salz" → null
 */
export function parseIngredientNumber(ingredient: string): number | null {
  const match = ingredient.match(/^(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  return parseFloat(match[1].replace(',', '.'))
}

/**
 * Splits an ingredient string into its leading numeric prefix and the remainder.
 * The num field preserves the original string (e.g. "1,5" not 1.5).
 * Returns null if no leading number exists — consistent with parseIngredientNumber.
 * Example: "150g Butter" → { num: "150", rest: "g Butter" }
 */
export function splitIngredient(ingredient: string): { num: string; rest: string } | null {
  const match = ingredient.match(/^(\d+(?:[.,]\d+)?)(.*)/)
  if (!match) return null
  return { num: match[1], rest: match[2] }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --run --reporter=verbose frontend/src/utils/scaling.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/scaling.ts frontend/src/utils/scaling.test.ts
git commit -m "feat: add parseIngredientNumber and splitIngredient utilities"
```

---

## Task 2: Ingredient list UI with inline editing

**Files:**
- Modify: `frontend/src/components/RecipeDetail.tsx`

- [ ] **Step 1: Add imports and state**

At the top of `RecipeDetail.tsx`, add `Pencil` and `RotateCcw` to the lucide-react import:

```ts
import { ArrowLeft, Clock, Users, Flame, Edit, Trash2, ChefHat, Loader2, AlertCircle, ExternalLink, Save, X, Pencil, RotateCcw } from 'lucide-react'
```

Add utility imports:

```ts
import { parseServingsNumber, scaleIngredient, parseIngredientNumber, splitIngredient } from '../utils/scaling.js'
```

Add state inside the component (after existing state declarations):

```ts
const [editingIngredientIndex, setEditingIngredientIndex] = useState<number | null>(null)
const [editingValue, setEditingValue] = useState('')
```

- [ ] **Step 2: Add confirm handler**

Add this function after `handleSave`:

```ts
const handleIngredientConfirm = (index: number) => {
  const enteredValue = parseFloat(editingValue)
  if (!isNaN(enteredValue) && enteredValue > 0 && recipe) {
    const originalNum = parseIngredientNumber(recipe.ingredients[index])
    if (originalNum && originalNum > 0) {
      setServingMultiplier(Math.max(0.01, enteredValue / originalNum))
    }
  }
  setEditingIngredientIndex(null)
  setEditingValue('')
}
```

- [ ] **Step 3: Replace the ingredients section**

Find and replace the entire ingredients column (from the scaling hint div through the end of the view-mode `<ul>`). The new version restructures the heading row and adds pencil icons:

Replace this block:
```tsx
{!isEditing && servingMultiplier !== 1 && (
  <div className="mb-2 text-xs text-paprika font-medium flex items-center space-x-1">
    <span>Zutaten für ×{servingMultiplier} skaliert</span>
    <button onClick={() => setServingMultiplier(1)} className="ml-1 underline hover:no-underline">
      Zurücksetzen
    </button>
  </div>
)}
<h2 className="text-xl font-display font-bold mb-4 pb-2 border-b border-warmgray/10">
  Zutaten
</h2>
```

With:
```tsx
<div className="flex items-center justify-between mb-4 pb-2 border-b border-warmgray/10">
  <h2 className="text-xl font-display font-bold">Zutaten</h2>
  {!isEditing && servingMultiplier !== 1 && (
    <button
      onClick={() => { setServingMultiplier(1); setEditingIngredientIndex(null) }}
      className="flex items-center gap-1 text-xs text-paprika/70 hover:text-paprika transition-colors"
    >
      <RotateCcw size={12} />
      Zurücksetzen
    </button>
  )}
</div>
```

Then replace the view-mode `<ul>` (inside the `} : (` branch of the ingredients section):

Replace:
```tsx
<ul className="space-y-2">
  {recipe.ingredients.map((ingredient, index) => (
    <li key={index} className="flex items-start space-x-3">
      <div className="w-2 h-2 bg-paprika rounded-full mt-2.5 flex-shrink-0"></div>
      <span className="text-warmgray text-sm">
        {servingMultiplier === 1 ? ingredient : scaleIngredient(ingredient, servingMultiplier)}
      </span>
    </li>
  ))}
</ul>
```

With:
```tsx
<ul className="space-y-2">
  {recipe.ingredients.map((ingredient, index) => {
    const split = parseIngredientNumber(ingredient) !== null ? splitIngredient(ingredient) : null
    const isEditingThis = editingIngredientIndex === index
    const displayedIngredient = servingMultiplier === 1 ? ingredient : scaleIngredient(ingredient, servingMultiplier)
    return (
      <li key={index} className="flex items-start space-x-3 group">
        <div className="w-2 h-2 bg-paprika rounded-full mt-2.5 flex-shrink-0"></div>
        <span className="text-warmgray text-sm flex-1 flex items-baseline gap-0.5">
          {isEditingThis && split ? (
            <>
              <input
                type="number"
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onBlur={() => handleIngredientConfirm(index)}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') { setEditingIngredientIndex(null); setEditingValue('') }
                }}
                autoFocus
                step="any"
                min="0.01"
                className="w-16 text-right bg-cream border-b border-paprika focus:outline-none text-sm"
              />
              <span>{split.rest}</span>
            </>
          ) : (
            displayedIngredient
          )}
        </span>
        {!isEditing && split && (
          isEditingThis ? (
            <button
              onMouseDown={e => { e.preventDefault(); setEditingIngredientIndex(null); setEditingValue('') }}
              className="flex-shrink-0 mt-0.5 text-warmgray/40 hover:text-red-400 transition-colors"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              onClick={() => {
                const originalNum = parseIngredientNumber(ingredient)!
                const scaledNum = Math.round(originalNum * servingMultiplier * 10) / 10
                setEditingValue(String(scaledNum))
                setEditingIngredientIndex(index)
              }}
              className="flex-shrink-0 mt-0.5 text-warmgray/30 hover:text-paprika transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <Pencil size={14} />
            </button>
          )
        )}
      </li>
    )
  })}
</ul>
```

- [ ] **Step 4: Build and verify**

```bash
npm run build:react 2>&1
```

Expected: `✓ built in ...` with no TypeScript errors.

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --run --exclude="test/e2e/**"
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/RecipeDetail.tsx
git commit -m "feat: add ingredient-based scaling with pencil edit and reset button"
```
