// Shared recipe QR utility — platform-independent (no DOM, no fetch)

interface CompactRecipe {
  n: string    // name
  e: string    // emoji
  i: string[]  // ingredients
  s: string[]  // steps
  r?: string   // rating
}

export interface RecipeQRData {
  name: string
  emoji?: string
  ingredients: string[]
  steps: string[]
  servings?: string
  duration?: string
  tags?: string[]
  rating?: number
  source_url?: string
}

function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

export function encodeRecipeToCompactJSON(recipe: RecipeQRData): string | null {
  const compact: CompactRecipe = {
    n: recipe.name,
    e: recipe.emoji ?? '',
    i: recipe.ingredients,
    s: recipe.steps.map(s => truncateString(s, 100)),
  }

  if (recipe.rating) {
    compact.r = String(recipe.rating)
  }

  const json = JSON.stringify(compact)

  // 2KB limit
  const bytes = new TextEncoder().encode(json).length
  if (bytes > 2048) return null

  return btoa(unescape(encodeURIComponent(json)))
}

export function decodeRecipeFromCompactJSON(encoded: string): CompactRecipe | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)))
    const parsed = JSON.parse(json)
    if (!parsed.n || !Array.isArray(parsed.i) || !Array.isArray(parsed.s)) return null
    return parsed as CompactRecipe
  } catch {
    return null
  }
}

export function parseCompactRecipeToFull(recipe: CompactRecipe): RecipeQRData {
  return {
    name: recipe.n,
    emoji: recipe.e,
    ingredients: recipe.i,
    steps: recipe.s,
    rating: recipe.r ? parseInt(recipe.r, 10) : undefined,
    servings: '',
    duration: '',
    tags: [],
    source_url: '',
  }
}

export function isRecipeJSONQR(data: string): boolean {
  try {
    return decodeRecipeFromCompactJSON(data) !== null
  } catch {
    return false
  }
}
