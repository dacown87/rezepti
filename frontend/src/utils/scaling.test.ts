import { describe, it, expect } from 'vitest'
import { parseServingsNumber, scaleIngredient, parseIngredientNumber, splitIngredient } from './scaling.js'

describe('parseServingsNumber', () => {
  it('extracts number from "4 Portionen"', () => {
    expect(parseServingsNumber('4 Portionen')).toBe(4)
  })
  it('extracts number from "2 Personen"', () => {
    expect(parseServingsNumber('2 Personen')).toBe(2)
  })
  it('returns 4 as default for unrecognized strings', () => {
    expect(parseServingsNumber('für viele')).toBe(4)
  })
  it('handles plain number string "6"', () => {
    expect(parseServingsNumber('6')).toBe(6)
  })
})

describe('scaleIngredient', () => {
  it('scales "200g Mehl" by 2x', () => {
    expect(scaleIngredient('200g Mehl', 2)).toBe('400g Mehl')
  })
  it('scales "2 EL Öl" by 0.5x', () => {
    expect(scaleIngredient('2 EL Öl', 0.5)).toBe('1 EL Öl')
  })
  it('scales "1 Prise Salz" by 2x', () => {
    expect(scaleIngredient('1 Prise Salz', 2)).toBe('2 Prise Salz')
  })
  it('returns ingredient unchanged when no leading number found', () => {
    expect(scaleIngredient('Salz nach Geschmack', 2)).toBe('Salz nach Geschmack')
  })
  it('scales "100g Butter" by 3x to 300g', () => {
    expect(scaleIngredient('100g Butter', 3)).toBe('300g Butter')
  })
  it('scales "100g Mehl" by 2x to 200g (no trailing decimal)', () => {
    expect(scaleIngredient('100g Mehl', 2)).toBe('200g Mehl')
  })
})

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
