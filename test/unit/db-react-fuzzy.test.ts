import { describe, it, expect } from 'vitest'
import { extractIngredientName, isSimilar } from '../../src/ingredient-dictionary.js'

describe('isSimilar', () => {
  it('"mozarella" is similar to "mozzarella" (1 letter off)', () => {
    expect(isSimilar('mozarella', 'mozzarella')).toBe(true)
  })

  it('"tomaten" is similar to "tomate" (plural difference)', () => {
    expect(isSimilar('tomaten', 'tomate')).toBe(true)
  })

  it('"butter" is NOT similar to "mehl" (too different)', () => {
    expect(isSimilar('butter', 'mehl')).toBe(false)
  })

  it('exact match returns true', () => {
    expect(isSimilar('Mozzarella', 'Mozzarella')).toBe(true)
  })
})

describe('extractIngredientName', () => {
  it('"200g Mozzarella" → "Mozzarella"', () => {
    expect(extractIngredientName('200g Mozzarella')).toBe('Mozzarella')
  })

  it('"2 El Olivenöl" → "Olivenöl"', () => {
    expect(extractIngredientName('2 El Olivenöl')).toBe('Olivenöl')
  })

  it('"1 Prise Salz" → "Salz"', () => {
    expect(extractIngredientName('1 Prise Salz')).toBe('Salz')
  })

  it('"Tomaten" (no amount) → "Tomaten"', () => {
    expect(extractIngredientName('Tomaten')).toBe('Tomaten')
  })
})
