import { describe, it, expect } from 'vitest'
import { encodeRecipeToCompactJSON, decodeRecipeFromCompactJSON, parseCompactRecipeToFull, isRecipeJSONQR } from '../../mobile/utils/recipe-qr.js'
import type { RecipeQRData } from '../../mobile/utils/recipe-qr.js'

const baseRecipe: RecipeQRData = {
  name: 'Spaghetti puttanesca',
  emoji: '🍝',
  ingredients: ['300g Spaghetti', '2 Knoblauchzehen', '100g Oliven'],
  steps: ['Wasser kochen.', 'Spaghetti kochen.', 'Sauce zubereiten.'],
  tags: ['Pasta', 'Italienisch'],
  servings: '4 Portionen',
  duration: 'mittel',
  source_url: 'https://example.com',
}

describe('recipe-qr', () => {
  describe('encodeRecipeToCompactJSON', () => {
    it('encodes a recipe to base64', () => {
      const encoded = encodeRecipeToCompactJSON(baseRecipe)
      expect(encoded).not.toBeNull()
      expect(typeof encoded).toBe('string')
    })

    it('returns null when recipe exceeds 2KB', () => {
      const bigRecipe: RecipeQRData = {
        ...baseRecipe,
        steps: Array(50).fill('A'.repeat(200)),
      }
      const encoded = encodeRecipeToCompactJSON(bigRecipe)
      expect(encoded).toBeNull()
    })
  })

  describe('decodeRecipeFromCompactJSON', () => {
    it('roundtrip encode → decode', () => {
      const encoded = encodeRecipeToCompactJSON(baseRecipe)!
      const decoded = decodeRecipeFromCompactJSON(encoded)
      expect(decoded).not.toBeNull()
      expect(decoded!.n).toBe('Spaghetti puttanesca')
      expect(decoded!.i).toEqual(['300g Spaghetti', '2 Knoblauchzehen', '100g Oliven'])
      expect(Array.isArray(decoded!.s)).toBe(true)
    })

    it('returns null for invalid base64', () => {
      expect(decodeRecipeFromCompactJSON('not-valid-base64!!!')).toBeNull()
    })

    it('returns null when decoded JSON lacks required fields', () => {
      // Missing 'i' and 's' arrays
      const bad = btoa(JSON.stringify({ n: 'Test' }))
      expect(decodeRecipeFromCompactJSON(bad)).toBeNull()
    })

    it('returns null when i is not an array', () => {
      const bad = btoa(JSON.stringify({ n: 'Test', i: 'not-array', s: [] }))
      expect(decodeRecipeFromCompactJSON(bad)).toBeNull()
    })
  })

  describe('parseCompactRecipeToFull', () => {
    it('converts compact format to Recipe-like object', () => {
      const encoded = encodeRecipeToCompactJSON(baseRecipe)!
      const compact = decodeRecipeFromCompactJSON(encoded)!
      const full = parseCompactRecipeToFull(compact)
      expect(full.name).toBe('Spaghetti puttanesca')
      expect(full.emoji).toBe('🍝')
      expect(full.ingredients).toEqual(['300g Spaghetti', '2 Knoblauchzehen', '100g Oliven'])
    })
  })

  describe('isRecipeJSONQR', () => {
    it('returns true for valid encoded recipe', () => {
      const encoded = encodeRecipeToCompactJSON(baseRecipe)!
      expect(isRecipeJSONQR(encoded)).toBe(true)
    })

    it('returns false for arbitrary string', () => {
      expect(isRecipeJSONQR('https://example.com/recipe/123')).toBe(false)
    })

    it('returns false for invalid base64', () => {
      expect(isRecipeJSONQR('garbage!!!')).toBe(false)
    })
  })
})
