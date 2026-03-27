import type { Recipe } from '../api/types.js'

interface CompactRecipe {
  n: string   // name
  e: string   // emoji
  i: string[] // ingredients
  s: string[] // steps
  r?: string  // rating
}

function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

export function encodeRecipeToCompactJSON(recipe: Recipe): string | null {
  const compact: CompactRecipe = {
    n: recipe.name,
    e: recipe.emoji || '',
    i: recipe.ingredients,
    s: recipe.steps.map(s => truncateString(s, 100)),
  }
  
  if (recipe.rating) {
    compact.r = String(recipe.rating)
  }
  
  const json = JSON.stringify(compact)
  
  // Check if within 2KB limit (2048 bytes)
  const bytes = new TextEncoder().encode(json).length
  if (bytes > 2048) {
    return null
  }
  
  // Base64 encode for QR
  const base64 = btoa(unescape(encodeURIComponent(json)))
  return base64
}

export function decodeRecipeFromCompactJSON(encoded: string): CompactRecipe | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)))
    const parsed = JSON.parse(json)
    
    // Validate basic structure and types
    if (!parsed.n || !Array.isArray(parsed.i) || !Array.isArray(parsed.s)) {
      return null
    }
    
    return parsed as CompactRecipe
  } catch {
    return null
  }
}

export function parseCompactRecipeToFull(recipe: CompactRecipe): Partial<Recipe> {
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
    const decoded = decodeRecipeFromCompactJSON(data)
    return decoded !== null
  } catch {
    return false
  }
}