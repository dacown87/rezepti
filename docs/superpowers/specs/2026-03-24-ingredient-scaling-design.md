# Ingredient-Based Scaling — Design Spec

**Date:** 2026-03-24
**Branch:** feature/react-migration

## Overview

Allow users to scale a recipe by fixing one ingredient's quantity. Clicking the pencil icon next to an ingredient opens an inline number input. Changing the value recalculates the global serving multiplier so all other ingredients scale proportionally. A reset button restores everything to the original quantities.

## Scope

- View mode only (not in edit mode)
- Ingredients with a leading number only (e.g. "150g Butter" → editable; "Salz nach Geschmack" → no icon)
- Integrates with the existing `servingMultiplier` state

## UI Behaviour

### Pencil Icon
- Shown to the right of each ingredient line that has a parseable leading number
- Desktop: visible on hover (`group-hover`)
- Mobile: always visible, but small and subtle (light gray)
- Icon: `Pencil` from lucide-react, size 14

### Active Edit State
- Clicking the pencil replaces the leading number with a narrow `<input type="number">` inline
- The rest of the ingredient string (e.g. "g Butter") stays as plain text next to the input
- The pencil icon becomes an `×` cancel button
- Only one ingredient can be in edit state at a time
- **Invariant:** the pencil icon is only rendered when `parseIngredientNumber(ingredient) !== null`, which guarantees `splitIngredient(ingredient)` is also non-null. No null-check is needed at the render site.

### Confirming and Cancelling
- **Confirm:** Enter key or blur → compute new multiplier, close input
- **Cancel:** click `×` (`X` lucide icon, size 14) or Escape key → discard input, close, multiplier unchanged
- **Clicking a second pencil:** the first input fires `blur`, which **confirms** the first edit before opening the second. This is intentional — blur always confirms.
- **Invalid input:** if `enteredValue` is `NaN`, `<= 0`, or empty on confirm → do nothing, close input without changing the multiplier (silent no-op, no error message)
- After confirming, the ingredient's displayed value comes from `scaleIngredient(original, newMultiplier)` like all others. Minor rounding differences are acceptable.

### Input Initial Value
When the pencil is clicked, the input is pre-filled with the **currently displayed scaled value** (`Math.round(originalNumber * servingMultiplier * 10) / 10`), not the original unscaled value. This way a user who has already scaled ×2 sees the current quantity and can adjust from there.

### Input Value Parsing
`editingValue` is a `string` (as `<input type="number">` always exposes). On confirm, parse with `parseFloat(editingValue)`. No comma-to-dot conversion is needed since `type="number"` always outputs dot-decimal regardless of locale.

### Scaling Logic
- Base value: always parsed from the **original** `recipe.ingredients[i]` (never the currently displayed scaled value) to prevent rounding drift
- New multiplier = `enteredValue / originalNumber`
- `setServingMultiplier(newMultiplier)` → existing display logic handles all other ingredients
- Multiplier is clamped to a minimum of `0.01` (but `<= 0` inputs are rejected as invalid, see above)
- No maximum is enforced — the user may enter any positive value
- The serving stepper (`−`/`+` buttons) remains functional after a free-form pin. Its disabled states (`<= 0.5`, `>= 4`) may not apply when the multiplier is outside that range — this is acceptable. The reset button is the primary way back to the default state.

### Reset Button
- Label: "Zurücksetzen" with `RotateCcw` icon (lucide-react)
- Shown only when `servingMultiplier !== 1`
- Positioned in the ingredients section header in the same row as the "Zutaten" heading, right-aligned. The heading row becomes a flex row: `<div className="flex items-center justify-between mb-4 pb-2 border-b border-warmgray/10">`. The existing `<h2>` moves inside this div; the reset button sits to its right.
- Click: `setServingMultiplier(1)`, `setEditingIngredientIndex(null)`
- Replaces the existing "Zurücksetzen" link that currently appears above the ingredient list (the `div` containing `"Zutaten für ×{servingMultiplier} skaliert"`)

## State Changes in RecipeDetail

| State | Type | Purpose |
|---|---|---|
| `editingIngredientIndex` | `number \| null` | Which ingredient is currently being edited |
| `editingValue` | `string` | Current text in the active input |

## Utility Functions (scaling.ts)

### `parseIngredientNumber(ingredient: string): number | null`
- Extracts the leading number from an ingredient string
- Supports both `.` and `,` as decimal separator (e.g. "1,5 EL" → 1.5)
- Returns `null` if no leading number exists
- Examples: `"150g Butter"` → `150`, `"1,5 EL Öl"` → `1.5`, `"Salz"` → `null`

### `splitIngredient(ingredient: string): { num: string; rest: string } | null`
- Returns the numeric prefix (original string, not parsed) and the remainder, or `null` if no leading number
- Example: `"150g Butter"` → `{ num: "150", rest: "g Butter" }`
- Returns `null` only when `parseIngredientNumber` would also return `null` — these two functions are always consistent

## Out of Scope

- Mid-string numbers ("Saft von 1 Zitrone") — not scaled (existing limitation of `scaleIngredient`)
- Edit mode — pencil icons are hidden when `isEditing` is true
- Persisting the scaled values — scaling is always display-only

## Files to Change

| File | Change |
|---|---|
| `frontend/src/utils/scaling.ts` | Add `parseIngredientNumber`, `splitIngredient` |
| `frontend/src/components/RecipeDetail.tsx` | Add `editingIngredientIndex`, `editingValue` state; rework ingredient list rendering; restructure heading+reset row |
| `frontend/src/utils/scaling.test.ts` | Add tests for the two new utility functions |
