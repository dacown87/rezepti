const LEADING_NUMBER_RE = /^(\d+(?:[.,]\d+)?)/
const UNIT_RE = /\b(g|kg|ml|l|el|tl|tsp|tbsp|prise|stk|stück|pack|päckchen|dose|n)\b/i;

export interface IngredientParseResult {
  name: string;
  quantity?: string;
  unit?: string;
}

function splitIngredient(ingredient: string): { num: string; rest: string } | null {
  const match = ingredient.match(new RegExp(LEADING_NUMBER_RE.source + '(.*)'))
  if (!match) return null
  return { num: match[1], rest: match[2] }
}

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

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

export function isSimilar(a: string, b: string, maxDistance?: number): boolean {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return false

  const threshold = maxDistance ?? Math.max(1, Math.floor(0.3 * maxLen))
  const distance = levenshtein(a.toLowerCase(), b.toLowerCase())
  return distance <= threshold
}

export function parseIngredientFull(fullIngredient: string): IngredientParseResult {
  const split = splitIngredient(fullIngredient)

  if (!split) {
    return { name: fullIngredient.trim() }
  }

  const rest = split.rest.trim()
  const unitMatch = rest.match(UNIT_RE)

  return {
    quantity: split.num,
    unit: unitMatch ? unitMatch[1].toLowerCase() : undefined,
    name: unitMatch
      ? rest.slice(unitMatch.index! + unitMatch[0].length).trim() || rest
      : rest,
  }
}