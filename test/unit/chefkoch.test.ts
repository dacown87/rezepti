import { describe, it, expect } from 'vitest'
import { parseGermanPortions } from '../../src/fetchers/chefkoch.js'
import { resolveSchemaImage } from '../../src/fetchers/web/base.js'

// ─── parseGermanPortions ─────────────────────────────────────────────────────

describe('parseGermanPortions', () => {
  it('parses "für 4 Personen"', () => {
    expect(parseGermanPortions('für 4 Personen')).toBe('4')
  })

  it('parses "für 1 Person"', () => {
    expect(parseGermanPortions('für 1 Person')).toBe('1')
  })

  it('parses "für 4 Personen (ca. 40 Stück)" — person match wins', () => {
    expect(parseGermanPortions('für 4 Personen (ca. 40 Stück)')).toBe('4')
  })

  it('parses "ca. 6 Stück"', () => {
    expect(parseGermanPortions('ca. 6 Stück')).toBe('6')
  })

  it('parses "etwa 8 Stück"', () => {
    expect(parseGermanPortions('etwa 8 Stück')).toBe('8')
  })

  it('parses "4 Portionen"', () => {
    expect(parseGermanPortions('4 Portionen')).toBe('4')
  })

  it('parses "6 Stück" (no prefix)', () => {
    expect(parseGermanPortions('6 Stück')).toBe('6')
  })

  it('parses standalone number "4"', () => {
    expect(parseGermanPortions('4')).toBe('4')
  })

  it('returns undefined for undefined input', () => {
    expect(parseGermanPortions(undefined)).toBeUndefined()
  })

  it('returns raw text if no pattern matches', () => {
    expect(parseGermanPortions('Eine Torte')).toBe('Eine Torte')
  })
})

// ─── resolveSchemaImage ──────────────────────────────────────────────────────

describe('resolveSchemaImage', () => {
  it('returns undefined for undefined', () => {
    expect(resolveSchemaImage(undefined)).toBeUndefined()
  })

  it('returns string image directly', () => {
    expect(resolveSchemaImage('https://example.com/bild.jpg')).toBe('https://example.com/bild.jpg')
  })

  it('returns first element of string array', () => {
    expect(resolveSchemaImage(['https://a.com/1.jpg', 'https://a.com/2.jpg'])).toBe('https://a.com/1.jpg')
  })

  it('returns url from object image', () => {
    expect(resolveSchemaImage({ url: 'https://b.com/img.jpg' })).toBe('https://b.com/img.jpg')
  })

  it('returns url from first object in array', () => {
    expect(resolveSchemaImage([{ url: 'https://c.com/img.jpg' }])).toBe('https://c.com/img.jpg')
  })

  it('returns undefined for empty array', () => {
    expect(resolveSchemaImage([])).toBeUndefined()
  })

  it('returns undefined for object without url', () => {
    expect(resolveSchemaImage({} as { url?: string })).toBeUndefined()
  })
})
