import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  isRecipeVisibleToAuth,
  isRecipeLegalForCollection,
  deriveRecipeShareReadModel,
  type RecipeAuthContext,
  type RecipeOwnerRow,
} from '../../src/db-react.js'

// ─── Pure predicates / read-model mapper (always run, no DB) ───────────────────

const USER_A = '20000000-0000-0000-0000-00000000000a'
const USER_B = '20000000-0000-0000-0000-00000000000b'
const HOUSEHOLD_1 = '10000000-0000-0000-0000-000000000001'
const HOUSEHOLD_2 = '10000000-0000-0000-0000-000000000002'

const authA: RecipeAuthContext = { userId: USER_A, memberships: [{ householdId: HOUSEHOLD_1 }] }
const authB: RecipeAuthContext = { userId: USER_B, memberships: [] }

const privateRecipeA: RecipeOwnerRow = { id: 1, ownerType: 'user', ownerUserId: USER_A, householdId: null }
const privateRecipeB: RecipeOwnerRow = { id: 2, ownerType: 'user', ownerUserId: USER_B, householdId: null }
const householdRecipe1: RecipeOwnerRow = { id: 3, ownerType: 'household', ownerUserId: null, householdId: HOUSEHOLD_1 }
const householdRecipe2: RecipeOwnerRow = { id: 4, ownerType: 'household', ownerUserId: null, householdId: HOUSEHOLD_2 }

describe('isRecipeVisibleToAuth', () => {
  it('user sees own private recipe', () => {
    expect(isRecipeVisibleToAuth(authA, privateRecipeA)).toBe(true)
  })
  it('user does NOT see a foreign private recipe', () => {
    expect(isRecipeVisibleToAuth(authA, privateRecipeB)).toBe(false)
  })
  it('member sees their household recipe', () => {
    expect(isRecipeVisibleToAuth(authA, householdRecipe1)).toBe(true)
  })
  it('non-member does NOT see a household recipe', () => {
    expect(isRecipeVisibleToAuth(authA, householdRecipe2)).toBe(false)
  })
})

describe('isRecipeLegalForCollection', () => {
  it('private collection accepts the caller own private recipe', () => {
    expect(isRecipeLegalForCollection(authA, privateRecipeA, { ownerType: 'user', householdId: null })).toBe(true)
  })
  it('private collection accepts a visible household recipe', () => {
    expect(isRecipeLegalForCollection(authA, householdRecipe1, { ownerType: 'user', householdId: null })).toBe(true)
  })
  it('private collection REJECTS a foreign user private recipe', () => {
    expect(isRecipeLegalForCollection(authA, privateRecipeB, { ownerType: 'user', householdId: null })).toBe(false)
  })
  it('household collection REJECTS a private recipe', () => {
    expect(isRecipeLegalForCollection(authA, privateRecipeA, { ownerType: 'household', householdId: HOUSEHOLD_1 })).toBe(false)
  })
  it('household collection accepts only recipes of that same household', () => {
    expect(isRecipeLegalForCollection(authA, householdRecipe1, { ownerType: 'household', householdId: HOUSEHOLD_1 })).toBe(true)
    expect(isRecipeLegalForCollection(authA, householdRecipe2, { ownerType: 'household', householdId: HOUSEHOLD_1 })).toBe(false)
  })
})

describe('deriveRecipeShareReadModel', () => {
  it('private recipe with an active household → can share to household, cannot copy to private', () => {
    const model = deriveRecipeShareReadModel(authA, privateRecipeA, { isFavorite: true, hasActiveHousehold: true })
    expect(model).toEqual({
      scope: 'private',
      isFavorite: true,
      canShareToHousehold: true,
      canCopyToPrivate: false,
    })
  })
  it('private recipe without an active household → cannot share to household', () => {
    const model = deriveRecipeShareReadModel(authB, privateRecipeB, { isFavorite: false, hasActiveHousehold: false })
    expect(model.canShareToHousehold).toBe(false)
    expect(model.scope).toBe('private')
  })
  it('household recipe → can copy to private, cannot share to household', () => {
    const model = deriveRecipeShareReadModel(authA, householdRecipe1, { isFavorite: false, hasActiveHousehold: true })
    expect(model).toEqual({
      scope: 'household',
      isFavorite: false,
      canShareToHousehold: false,
      canCopyToPrivate: true,
    })
  })
})

// ─── DB integration tests (requires TEST_DATABASE_URL) ────────────────────────
//
// To run locally: TEST_DATABASE_URL=postgresql://... npm test
// Requires the recipe_collections + recipe_collection_items migrations applied.

const hasTestDb = !!process.env.TEST_DATABASE_URL
const TEST_HOUSEHOLD_ID = '10000000-0000-0000-0000-000000000001'
const TEST_USER_ID = '20000000-0000-0000-0000-000000000002'
const FOREIGN_USER_ID = '20000000-0000-0000-0000-000000000003'

const AUTH: RecipeAuthContext = {
  userId: TEST_USER_ID,
  memberships: [{ householdId: TEST_HOUSEHOLD_ID }],
}
const FOREIGN_AUTH: RecipeAuthContext = {
  userId: FOREIGN_USER_ID,
  memberships: [],
}
const PRIVATE_OWNER = {
  owner: { type: 'user' as const, userId: TEST_USER_ID },
  createdBy: TEST_USER_ID,
}
const HOUSEHOLD_OWNER = {
  owner: { type: 'household' as const, householdId: TEST_HOUSEHOLD_ID },
  createdBy: TEST_USER_ID,
}
const FOREIGN_PRIVATE_OWNER = {
  owner: { type: 'user' as const, userId: FOREIGN_USER_ID },
  createdBy: FOREIGN_USER_ID,
}

function sampleRecipe(name: string) {
  return {
    name,
    duration: 'kurz' as const,
    tags: ['test'],
    emoji: '🧪',
    ingredients: ['100g Salz'],
    steps: ['Salz hinzufügen.'],
  }
}

describe.skipIf(!hasTestDb)('Collections / Favorites / Sharing (DB)', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any
  const createdRecipeIds: number[] = []
  const createdCollectionIds: string[] = []

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    db = await import('../../src/db-react.js')
  })

  afterAll(async () => {
    for (const id of createdCollectionIds) {
      try { await db.deleteCollection(AUTH, id) } catch { /* ignore */ }
    }
    for (const id of createdRecipeIds) {
      try { await db.deleteRecipeFromReactDb(id, AUTH) } catch { /* ignore */ }
    }
  })

  it('favorites bootstrap is idempotent (resolve twice → same id)', async () => {
    const first = await db.resolveFavoritesCollection(AUTH, 'user')
    const second = await db.resolveFavoritesCollection(AUTH, 'user')
    expect(first).toBe(second)
  })

  it('private collection rejects a foreign user private recipe', async () => {
    const foreignId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ foreign private'), 'https://example.com/foreign', undefined, FOREIGN_PRIVATE_OWNER,
    )
    createdRecipeIds.push(foreignId)

    const collection = await db.createCollection(AUTH, { name: '__test__ private coll', ownerType: 'user' })
    createdCollectionIds.push(collection.id)

    await expect(db.addRecipeToCollection(AUTH, collection.id, foreignId)).rejects.toThrow()
  })

  it('household collection rejects a private recipe', async () => {
    const privateId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ my private'), 'https://example.com/mine', undefined, PRIVATE_OWNER,
    )
    createdRecipeIds.push(privateId)

    const householdColl = await db.createCollection(AUTH, {
      name: '__test__ household coll',
      ownerType: 'household',
      householdId: TEST_HOUSEHOLD_ID,
    })
    createdCollectionIds.push(householdColl.id)

    await expect(db.addRecipeToCollection(AUTH, householdColl.id, privateId)).rejects.toThrow()
  })

  it('addRecipeToCollection duplicate is idempotent (unique index)', async () => {
    const recipeId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ dup'), 'https://example.com/dup', undefined, PRIVATE_OWNER,
    )
    createdRecipeIds.push(recipeId)
    const collection = await db.createCollection(AUTH, { name: '__test__ dup coll', ownerType: 'user' })
    createdCollectionIds.push(collection.id)

    const first = await db.addRecipeToCollection(AUTH, collection.id, recipeId)
    const second = await db.addRecipeToCollection(AUTH, collection.id, recipeId)
    expect(first.added).toBe(true)
    expect(second.added).toBe(false)

    const collections = await db.getCollectionsForAuth(AUTH)
    const summary = collections.find((c: { id: string }) => c.id === collection.id)
    expect(summary?.item_count).toBe(1)
  })

  it('shareCopyRecipe private→household yields a new id with household owner + source_recipe_id', async () => {
    const originalId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ share src'), 'https://example.com/share', undefined, PRIVATE_OWNER,
    )
    createdRecipeIds.push(originalId)

    const copy = await db.shareCopyRecipe(AUTH, originalId, { type: 'household', householdId: TEST_HOUSEHOLD_ID })
    createdRecipeIds.push(copy.id)

    expect(copy.id).not.toBe(originalId)
    expect(copy.ownerType).toBe('household')
    expect(copy.householdId).toBe(TEST_HOUSEHOLD_ID)
    expect(copy.source_recipe_id).toBe(originalId)

    // original untouched
    const original = await db.getRecipeByIdFromReactDb(originalId, AUTH)
    expect(original.ownerType).toBe('user')
    expect(original.source_recipe_id ?? null).toBeNull()
  })

  it('shareCopyRecipe household→user yields a new id owned by the caller', async () => {
    const originalId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ hh src'), 'https://example.com/hh', undefined, HOUSEHOLD_OWNER,
    )
    createdRecipeIds.push(originalId)

    const copy = await db.shareCopyRecipe(AUTH, originalId, { type: 'user' })
    createdRecipeIds.push(copy.id)

    expect(copy.id).not.toBe(originalId)
    expect(copy.ownerType).toBe('user')
    expect(copy.ownerUserId).toBe(TEST_USER_ID)
    expect(copy.source_recipe_id).toBe(originalId)
  })

  it('shareCopyRecipe rejects a recipe not visible to the caller', async () => {
    const foreignId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ foreign share'), 'https://example.com/foreign-share', undefined, FOREIGN_PRIVATE_OWNER,
    )
    createdRecipeIds.push(foreignId)

    await expect(db.shareCopyRecipe(FOREIGN_AUTH, foreignId, { type: 'household', householdId: TEST_HOUSEHOLD_ID }))
      .rejects.toThrow()
    await expect(db.shareCopyRecipe(AUTH, foreignId, { type: 'user' })).rejects.toThrow()
  })

  it('setFavorite + toggleFavorite round-trip via the favorites collection', async () => {
    const recipeId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ fav'), 'https://example.com/fav', undefined, PRIVATE_OWNER,
    )
    createdRecipeIds.push(recipeId)

    await db.setFavorite(AUTH, recipeId, true, 'user')
    const favId = await db.resolveFavoritesCollection(AUTH, 'user')
    let collections = await db.getCollectionsForAuth(AUTH)
    let favSummary = collections.find((c: { id: string }) => c.id === favId)
    expect(favSummary?.is_system).toBe(true)
    expect(favSummary?.item_count).toBeGreaterThanOrEqual(1)

    const toggled = await db.toggleFavorite(AUTH, recipeId, 'user')
    expect(toggled.isFavorite).toBe(false)
  })

  // Pflichttest 7 — favorite toggle is idempotent (ON twice = one membership; OFF twice = none).
  it('favorite toggle is idempotent: ON twice = one membership, OFF twice = none', async () => {
    const recipeId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ idem fav'), 'https://example.com/idem-fav', undefined, PRIVATE_OWNER,
    )
    createdRecipeIds.push(recipeId)

    await db.setFavorite(AUTH, recipeId, true, 'user')
    await db.setFavorite(AUTH, recipeId, true, 'user') // ON again — must not duplicate
    let ids: Set<number> = await db.getFavoriteRecipeIdsForAuth(AUTH)
    expect(ids.has(recipeId)).toBe(true)
    expect(await db.isRecipeFavoritedByAuth(AUTH, recipeId)).toBe(true)

    await db.setFavorite(AUTH, recipeId, false, 'user')
    await db.setFavorite(AUTH, recipeId, false, 'user') // OFF again — must remain off
    ids = await db.getFavoriteRecipeIdsForAuth(AUTH)
    expect(ids.has(recipeId)).toBe(false)
    expect(await db.isRecipeFavoritedByAuth(AUTH, recipeId)).toBe(false)
  })

  // Pflichttest 8 — recipe list returns correct scope for private vs household recipes.
  it('recipe list read-model returns correct scope for private vs household recipes', async () => {
    const privateId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ rm private'), 'https://example.com/rm-private', undefined, PRIVATE_OWNER,
    )
    createdRecipeIds.push(privateId)
    const householdId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ rm household'), 'https://example.com/rm-household', undefined, HOUSEHOLD_OWNER,
    )
    createdRecipeIds.push(householdId)

    const list = await db.getRecipeListFromReactDb(AUTH)
    const priv = list.find((r: { id: number }) => r.id === privateId)
    const hh = list.find((r: { id: number }) => r.id === householdId)

    expect(priv?.scope).toBe('private')
    expect(priv?.canShareToHousehold).toBe(true)   // private + active household
    expect(priv?.canCopyToPrivate).toBe(false)
    expect(hh?.scope).toBe('household')
    expect(hh?.canCopyToPrivate).toBe(true)
    expect(hh?.canShareToHousehold).toBe(false)
  })

  // Pflichttest 9 — recipe detail returns isFavorite consistent with the favorites collection.
  it('recipe detail read-model reports isFavorite consistent with the favorites collection', async () => {
    const recipeId = await db.saveRecipeToReactDb(
      sampleRecipe('__test__ detail fav'), 'https://example.com/detail-fav', undefined, PRIVATE_OWNER,
    )
    createdRecipeIds.push(recipeId)

    let detail = await db.getRecipeByIdFromReactDb(recipeId, AUTH)
    expect(detail.isFavorite).toBe(false)

    await db.setFavorite(AUTH, recipeId, true, 'user')
    detail = await db.getRecipeByIdFromReactDb(recipeId, AUTH)
    expect(detail.isFavorite).toBe(true)

    await db.setFavorite(AUTH, recipeId, false, 'user')
    detail = await db.getRecipeByIdFromReactDb(recipeId, AUTH)
    expect(detail.isFavorite).toBe(false)
  })
})
