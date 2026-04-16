import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { detectCategory, CATEGORY_KEYWORDS } from '../../src/db-react.js'

// ─── detectCategory (pure function — always run) ──────────────────────────────

describe('detectCategory', () => {
  it('detects Nudelgericht from tags', () => {
    expect(detectCategory(['pasta', 'vegan'], 'Spaghetti Aglio')).toBe('Nudelgericht')
  })

  it('detects Nudelgericht from name', () => {
    expect(detectCategory([], 'Penne all\'Arrabbiata')).toBe('Nudelgericht')
  })

  it('detects Suppe from name', () => {
    expect(detectCategory([], 'Tomatensuppe mit Croutons')).toBe('Suppe')
  })

  it('detects Salat from tags', () => {
    expect(detectCategory(['salat', 'frisch'], 'Gemischter Teller')).toBe('Salat')
  })

  it('detects Gebäck & Kuchen from name', () => {
    expect(detectCategory([], 'Schokoladenkuchen mit Glasur')).toBe('Gebäck & Kuchen')
  })

  it('detects Fleischgericht from name', () => {
    expect(detectCategory([], 'Wiener Schnitzel mit Kartoffelsalat')).toBe('Fleischgericht')
  })

  it('detects Geflügel from name', () => {
    expect(detectCategory([], 'Hähnchenbrust mit Gemüse')).toBe('Geflügel')
  })

  it('detects Fischgericht from tags', () => {
    expect(detectCategory(['fisch', 'mediterran'], 'Gegrillter Teller')).toBe('Fischgericht')
  })

  it('detects Vegetarisch from tags', () => {
    expect(detectCategory(['vegan', 'glutenfrei'], 'Gemüse-Bowl')).toBe('Vegetarisch')
  })

  it('detects Asiatisch from name', () => {
    expect(detectCategory([], 'Thai Curry mit Kokosmilch')).toBe('Asiatisch')
  })

  it('detects Frühstück from name', () => {
    expect(detectCategory([], 'Amerikanische Pancakes')).toBe('Frühstück')
  })

  it('detects Auflauf from name', () => {
    expect(detectCategory([], 'Kartoffelgratin aus dem Ofen')).toBe('Auflauf')
  })

  it('detects Snack from tags', () => {
    expect(detectCategory(['vorspeise', 'schnell'], 'Käseplatte')).toBe('Snack')
  })

  it('returns null for unknown category', () => {
    expect(detectCategory([], 'Etwas Unbekanntes')).toBeNull()
  })

  it('returns null for empty name and tags', () => {
    expect(detectCategory([], '')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(detectCategory(['PASTA'], 'LASAGNE')).toBe('Auflauf')
  })
})

describe('CATEGORY_KEYWORDS completeness', () => {
  it('has at least 10 categories defined', () => {
    expect(CATEGORY_KEYWORDS.length).toBeGreaterThanOrEqual(10)
  })

  it('every category has a non-empty keyword list', () => {
    for (const { category, keywords } of CATEGORY_KEYWORDS) {
      expect(keywords.length, `${category} has no keywords`).toBeGreaterThan(0)
    }
  })

  it('every keyword is lowercase (consistent matching)', () => {
    for (const { category, keywords } of CATEGORY_KEYWORDS) {
      for (const kw of keywords) {
        expect(kw, `${category}: keyword "${kw}" is not lowercase`).toBe(kw.toLowerCase())
      }
    }
  })
})

// ─── DB integration tests (requires TEST_DATABASE_URL) ────────────────────────
//
// These tests run against a real Postgres database.
// To run locally:  TEST_DATABASE_URL=postgresql://... npm test
// In CI:           set via services.postgres in ci.yml

const hasTestDb = !!process.env.TEST_DATABASE_URL

describe.skipIf(!hasTestDb)('DB integration', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any

  beforeAll(async () => {
    // Point to test database before the lazy singleton initialises
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL

    // Dynamic import AFTER env var is set, so the singleton connects to the test DB
    const {
      saveRecipeToReactDb,
      getRecipeByIdFromReactDb,
      updateRecipeInReactDb,
      deleteRecipeFromReactDb,
      getAllRecipesFromReactDb,
    } = await import('../../src/db-react.js')

    db = { saveRecipeToReactDb, getRecipeByIdFromReactDb, updateRecipeInReactDb, deleteRecipeFromReactDb, getAllRecipesFromReactDb }
  })

  afterAll(async () => {
    // Restore original env
    if (process.env.ORIGINAL_DATABASE_URL) {
      process.env.DATABASE_URL = process.env.ORIGINAL_DATABASE_URL
    }
  })

  it('saves and retrieves a recipe', async () => {
    const id = await db.saveRecipeToReactDb(
      {
        name: '__test__ DB Integration',
        duration: 'kurz',
        tags: ['test'],
        emoji: '🧪',
        ingredients: ['100g Salz'],
        steps: ['Salz hinzufügen.'],
      },
      'https://example.com/test'
    )
    expect(id).toBeGreaterThan(0)

    const recipe = await db.getRecipeByIdFromReactDb(id)
    expect(recipe).not.toBeNull()
    expect(recipe!.name).toBe('__test__ DB Integration')
    expect(recipe!.ingredients).toEqual(['100g Salz'])
    expect(recipe!.tags).toEqual(['test'])

    // cleanup
    await db.deleteRecipeFromReactDb(id)
  })

  it('updates a recipe field', async () => {
    const id = await db.saveRecipeToReactDb(
      {
        name: '__test__ Update',
        duration: 'mittel',
        tags: [],
        emoji: '🧪',
        ingredients: ['Mehl'],
        steps: ['Backen.'],
      },
      'https://example.com/update-test'
    )

    const updated = await db.updateRecipeInReactDb(id, { name: '__test__ Updated Name' })
    expect(updated).toBe(true)

    const recipe = await db.getRecipeByIdFromReactDb(id)
    expect(recipe!.name).toBe('__test__ Updated Name')

    // cleanup
    await db.deleteRecipeFromReactDb(id)
  })

  it('deletes a recipe', async () => {
    const id = await db.saveRecipeToReactDb(
      {
        name: '__test__ Delete',
        duration: 'lang',
        tags: [],
        emoji: '🧪',
        ingredients: ['Wasser'],
        steps: ['Kochen.'],
      },
      'https://example.com/delete-test'
    )

    const deleted = await db.deleteRecipeFromReactDb(id)
    expect(deleted).toBe(true)

    const recipe = await db.getRecipeByIdFromReactDb(id)
    expect(recipe).toBeNull()
  })

  it('returns false when deleting non-existent recipe', async () => {
    const deleted = await db.deleteRecipeFromReactDb(999999999)
    expect(deleted).toBe(false)
  })
})
