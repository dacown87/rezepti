import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractIngredientName, isSimilar, parseIngredientFull } from '../../src/ingredient-dictionary.js'

describe('ingredient-dictionary', () => {
  describe('extractIngredientName', () => {
    it('extracts name from "200g Mehl"', () => {
      expect(extractIngredientName('200g Mehl')).toBe('Mehl')
    })

    it('extracts name from "1 EL Olivenöl"', () => {
      expect(extractIngredientName('1 EL Olivenöl')).toBe('Olivenöl')
    })

    it('returns full string when no number prefix', () => {
      expect(extractIngredientName('Salz')).toBe('Salz')
    })

    it('handles "Saft von 1 Zitrone" - returns full string when no clear unit', () => {
      expect(extractIngredientName('Saft von 1 Zitrone')).toBe('Saft von 1 Zitrone')
    })

    it('handles "500g Mehl, Type 405"', () => {
      expect(extractIngredientName('500g Mehl, Type 405')).toBe('Mehl, Type 405')
    })
  })

  describe('isSimilar', () => {
    it('returns true for identical strings', () => {
      expect(isSimilar('Mehl', 'Mehl')).toBe(true)
    })

    it('returns true for similar strings within threshold', () => {
      expect(isSimilar('Butter', 'Buter')).toBe(true)
    })

    it('returns false for dissimilar strings', () => {
      expect(isSimilar('Butter', 'Salz')).toBe(false)
    })

    it('uses relative threshold for short words - strict distance needed', () => {
      expect(isSimilar('Aa', 'Bb')).toBe(false)
    })

    it('accepts custom maxDistance', () => {
      expect(isSimilar('Mehl', 'Mehl', 5)).toBe(true)
    })
  })

  describe('parseIngredientFull', () => {
    it('parses "200g Mehl" fully', () => {
      const result = parseIngredientFull('200g Mehl')
      expect(result).toEqual({ quantity: '200', unit: 'g', name: 'Mehl' })
    })

    it('parses "1,5 EL Öl"', () => {
      const result = parseIngredientFull('1,5 EL Öl')
      expect(result).toEqual({ quantity: '1,5', unit: 'el', name: 'Öl' })
    })

    it('handles no unit case', () => {
      const result = parseIngredientFull('3 Eier')
      expect(result).toEqual({ quantity: '3', name: 'Eier' })
    })

    it('handles no quantity case', () => {
      const result = parseIngredientFull('Salz')
      expect(result).toEqual({ name: 'Salz' })
    })
  })
})