/** Matches a leading integer or decimal (dot or comma) at the start of an ingredient string. */
const LEADING_NUMBER_RE = /^(\d+(?:[.,]\d+)?)/

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
  return ingredient.replace(LEADING_NUMBER_RE, (match) => {
    const num = parseFloat(match.replace(',', '.')) * factor
    const rounded = Math.round(num * 10) / 10
    // JavaScript's String() already strips trailing .0 (e.g. String(300.0) → "300")
    return String(rounded)
  })
}

/**
 * Extracts the leading number from an ingredient string.
 * Supports both dot and comma as decimal separator.
 * Returns null if no leading number is found.
 * Examples: "150g Butter" → 150, "1,5 EL Öl" → 1.5, "Salz" → null
 */
export function parseIngredientNumber(ingredient: string): number | null {
  const match = ingredient.match(LEADING_NUMBER_RE)
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
  const match = ingredient.match(new RegExp(LEADING_NUMBER_RE.source + '(.*)'))
  if (!match) return null
  return { num: match[1], rest: match[2] }
}

const UNIT_RE = /\b(g|kg|ml|l|el|tl|tsp|tbsp|prise|stk|stück|pack|päckchen|dose|n)\b/i

export function extractIngredientName(fullIngredient: string): string {
  const split = splitIngredient(fullIngredient)

  if (!split) {
    return fullIngredient.trim()
  }

  const rest = split.rest.trim()

  const unitMatch = rest.match(UNIT_RE)
  if (unitMatch) {
    const unitEnd = unitMatch.index! + unitMatch[0].length
    const afterUnit = rest.slice(unitEnd).trim()
    if (afterUnit) {
      return afterUnit
    }
  }

  return rest || fullIngredient.trim()
}
