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
 * Scales the leading number in an ingredient string by the given factor.
 * Only scales numbers at the very start of the string.
 * Example: scaleIngredient("200g Mehl", 2) → "400g Mehl"
 * Known limitation: mid-string numbers (e.g. "Saft von 1 Zitrone") are not scaled.
 * Leaves strings without leading numbers unchanged.
 */
export function scaleIngredient(ingredient: string, factor: number): string {
  return ingredient.replace(/^(\d+(?:[.,]\d+)?)/, (match) => {
    const num = parseFloat(match.replace(',', '.')) * factor
    const rounded = Math.round(num * 10) / 10
    // JavaScript's String() already strips trailing .0 (e.g. String(300.0) → "300")
    return String(rounded)
  })
}
