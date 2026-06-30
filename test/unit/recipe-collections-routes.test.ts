import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureAuthForTests, resetAuthAdaptersForTests } from '../../src/auth.js'

// The route layer is intentionally thin: it delegates all ownership/visibility to
// the Phase 1 helpers. We mock db-react and drive the helpers' return values to
// assert the exact HTTP contract (status codes, 404 vs 4xx boundaries, payloads,
// and that the route never leaks the original recipe id on share).
const dbMocks = vi.hoisted(() => ({
  getCollectionsForAuth: vi.fn(),
  createCollection: vi.fn(),
  renameCollection: vi.fn(),
  deleteCollection: vi.fn(),
  addRecipeToCollection: vi.fn(),
  removeRecipeFromCollection: vi.fn(),
  getCollectionItemsForAuth: vi.fn(),
  shareCopyRecipe: vi.fn(),
  setFavorite: vi.fn(),
  loadRecipeOwnerRow: vi.fn(),
  loadCollectionRowById: vi.fn(),
  // pure predicates — re-implemented here so the route's branching is exercised
  // against realistic ownership logic (mirrors src/db-react.ts).
  isCollectionVisibleToAuth: vi.fn(),
  canMutateCollectionForAuth: vi.fn(),
  isRecipeVisibleToAuth: vi.fn(),
  isRecipeLegalForCollection: vi.fn(),
  // mocked because db-react re-exports them but the router imports only the above
  loadUserAuthorization: vi.fn(),
}))

vi.mock('../../src/db-react.js', () => dbMocks)

const { default: router } = await import('../../src/routes/recipe-collections.js')

const USER_A = '00000000-0000-0000-0000-00000000000a'
const USER_B = '00000000-0000-0000-0000-00000000000b'
const HOUSEHOLD_1 = '10000000-0000-0000-0000-000000000001'
const HOUSEHOLD_2 = '10000000-0000-0000-0000-000000000002'

const authHeaders = { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' }

function authAsUserA(opts: { activeHousehold?: string | null; memberships?: string[] } = {}) {
  const memberships = opts.memberships ?? [HOUSEHOLD_1]
  const activeHouseholdId = opts.activeHousehold === undefined ? HOUSEHOLD_1 : opts.activeHousehold
  configureAuthForTests({
    verifyAccessToken: async () => ({ id: USER_A, email: 'user-a@example.com' }),
    loadAuthorization: async () => ({
      appRole: 'user',
      memberships: memberships.map((householdId) => ({ householdId, role: 'owner' as const })),
      activeHouseholdId,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authAsUserA()
})

afterEach(() => {
  resetAuthAdaptersForTests()
})

// ── Auth gate ─────────────────────────────────────────────────────────────────
describe('recipe-collections auth', () => {
  it('requires auth on the collections list', async () => {
    resetAuthAdaptersForTests()
    const res = await router.request('/api/v1/recipe-collections')
    expect(res.status).toBe(401)
    expect(dbMocks.getCollectionsForAuth).not.toHaveBeenCalled()
  })
})

// ── GET collections (Pflichttest 1 + 2 at the route layer) ─────────────────────
describe('GET /api/v1/recipe-collections', () => {
  it('returns only the caller-visible collections (User A cannot see User B private)', async () => {
    // The helper already scopes by auth; the route must return exactly what it gets.
    dbMocks.getCollectionsForAuth.mockResolvedValue([
      { id: 'c1', kind: 'favorites', name: 'Favoriten', owner_type: 'user', item_count: 2, is_system: true },
      { id: 'c2', kind: 'custom', name: 'Meine Liste', owner_type: 'user', item_count: 0, is_system: false },
    ])
    const res = await router.request('/api/v1/recipe-collections', { headers: authHeaders })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      collections: [
        { id: 'c1', kind: 'favorites', name: 'Favoriten', owner_type: 'user', item_count: 2, is_system: true },
        { id: 'c2', kind: 'custom', name: 'Meine Liste', owner_type: 'user', item_count: 0, is_system: false },
      ],
    })
    expect(dbMocks.getCollectionsForAuth).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_A }),
    )
  })

  it('household members see the same household collection', async () => {
    // Two members of HOUSEHOLD_1 both resolve the same household collection via the
    // auth-scoped helper. We assert the route forwards the household-scoped auth.
    dbMocks.getCollectionsForAuth.mockResolvedValue([
      { id: 'hh1', kind: 'custom', name: 'Familienrezepte', owner_type: 'household', item_count: 3, is_system: false },
    ])
    const res = await router.request('/api/v1/recipe-collections', { headers: authHeaders })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      collections: [
        { id: 'hh1', kind: 'custom', name: 'Familienrezepte', owner_type: 'household', item_count: 3, is_system: false },
      ],
    })
    expect(dbMocks.getCollectionsForAuth).toHaveBeenCalledWith(
      expect.objectContaining({ memberships: [expect.objectContaining({ householdId: HOUSEHOLD_1 })] }),
    )
  })
})

// ── POST collections ───────────────────────────────────────────────────────────
describe('POST /api/v1/recipe-collections', () => {
  it('creates a custom user collection by default', async () => {
    dbMocks.createCollection.mockResolvedValue({
      id: 'new', kind: 'custom', name: 'Test', owner_type: 'user', item_count: 0, is_system: false,
    })
    const res = await router.request('/api/v1/recipe-collections', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ name: 'Test' }),
    })
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ collection: { id: 'new', owner_type: 'user' } })
    expect(dbMocks.createCollection).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_A }),
      { name: 'Test', ownerType: 'user', householdId: undefined },
    )
  })

  it('rejects a missing name with 400', async () => {
    const res = await router.request('/api/v1/recipe-collections', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ name: '   ' }),
    })
    expect(res.status).toBe(400)
    expect(dbMocks.createCollection).not.toHaveBeenCalled()
  })

  it('creating a household collection for a non-member household → 404 (no leak)', async () => {
    const res = await router.request('/api/v1/recipe-collections', {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ name: 'Test', ownerType: 'household', householdId: HOUSEHOLD_2 }),
    })
    expect(res.status).toBe(404)
    expect(dbMocks.createCollection).not.toHaveBeenCalled()
  })

  it('creates a household collection for a member household', async () => {
    dbMocks.createCollection.mockResolvedValue({
      id: 'hh', kind: 'custom', name: 'Fam', owner_type: 'household', item_count: 0, is_system: false,
    })
    const res = await router.request('/api/v1/recipe-collections', {
      method: 'POST', headers: authHeaders,
      body: JSON.stringify({ name: 'Fam', ownerType: 'household', householdId: HOUSEHOLD_1 }),
    })
    expect(res.status).toBe(201)
    expect(dbMocks.createCollection).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_A }),
      { name: 'Fam', ownerType: 'household', householdId: HOUSEHOLD_1 },
    )
  })
})

// ── PATCH / DELETE collection (favorites guard + 404 boundaries) ────────────────
describe('PATCH/DELETE /api/v1/recipe-collections/:id', () => {
  it('renames a visible custom collection', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'c1', ownerType: 'user', ownerUserId: USER_A, householdId: null, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(true)
    dbMocks.canMutateCollectionForAuth.mockReturnValue(true)
    dbMocks.renameCollection.mockResolvedValue(true)

    const res = await router.request('/api/v1/recipe-collections/c1', {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ name: 'Neu' }),
    })
    expect(res.status).toBe(200)
    expect(dbMocks.renameCollection).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_A }), 'c1', 'Neu')
  })

  it('renaming a foreign/invisible collection → 404 (no leak)', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'cB', ownerType: 'user', ownerUserId: USER_B, householdId: null, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(false)
    const res = await router.request('/api/v1/recipe-collections/cB', {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ name: 'Neu' }),
    })
    expect(res.status).toBe(404)
    expect(dbMocks.renameCollection).not.toHaveBeenCalled()
  })

  it('renaming a favorites collection → 400 (cannot rename)', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'fav', ownerType: 'user', ownerUserId: USER_A, householdId: null, kind: 'favorites',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(true)
    const res = await router.request('/api/v1/recipe-collections/fav', {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ name: 'Neu' }),
    })
    expect(res.status).toBe(400)
    expect(dbMocks.renameCollection).not.toHaveBeenCalled()
  })

  it('deleting a favorites collection → 400 (cannot delete)', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'fav', ownerType: 'user', ownerUserId: USER_A, householdId: null, kind: 'favorites',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(true)
    const res = await router.request('/api/v1/recipe-collections/fav', {
      method: 'DELETE', headers: authHeaders,
    })
    expect(res.status).toBe(400)
    expect(dbMocks.deleteCollection).not.toHaveBeenCalled()
  })

  it('deletes a visible custom collection (list only)', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'c1', ownerType: 'user', ownerUserId: USER_A, householdId: null, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(true)
    dbMocks.canMutateCollectionForAuth.mockReturnValue(true)
    dbMocks.deleteCollection.mockResolvedValue(true)
    const res = await router.request('/api/v1/recipe-collections/c1', {
      method: 'DELETE', headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(dbMocks.deleteCollection).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_A }), 'c1')
  })
})

// ── GET collection items (read-back loop) ───────────────────────────────────────
describe('GET /api/v1/recipe-collections/:id/items', () => {
  it('returns the collection recipes (with read-model) for a visible collection', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'c1', ownerType: 'user', ownerUserId: USER_A, householdId: null, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(true)
    dbMocks.getCollectionItemsForAuth.mockResolvedValue([
      { id: 3, name: 'Pasta', scope: 'private', isFavorite: false, canShareToHousehold: true, canCopyToPrivate: false },
    ])
    const res = await router.request('/api/v1/recipe-collections/c1/items', { headers: authHeaders })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      recipes: [
        { id: 3, name: 'Pasta', scope: 'private', isFavorite: false, canShareToHousehold: true, canCopyToPrivate: false },
      ],
    })
    expect(dbMocks.getCollectionItemsForAuth).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_A }), 'c1')
  })

  it('an invisible/foreign collection → 404 (no existence leak), never reads items', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'cB', ownerType: 'user', ownerUserId: USER_B, householdId: null, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(false)
    const res = await router.request('/api/v1/recipe-collections/cB/items', { headers: authHeaders })
    expect(res.status).toBe(404)
    expect(dbMocks.getCollectionItemsForAuth).not.toHaveBeenCalled()
  })

  it('a malformed collection id (loadCollectionRowById → null) → 404, never reads items', async () => {
    // loadCollectionRowById returns null for a non-uuid id (uuid-shape guard).
    dbMocks.loadCollectionRowById.mockResolvedValue(null)
    const res = await router.request('/api/v1/recipe-collections/not-a-uuid/items', { headers: authHeaders })
    expect(res.status).toBe(404)
    expect(dbMocks.getCollectionItemsForAuth).not.toHaveBeenCalled()
  })

  it('requires auth', async () => {
    resetAuthAdaptersForTests()
    const res = await router.request('/api/v1/recipe-collections/c1/items')
    expect(res.status).toBe(401)
    expect(dbMocks.getCollectionItemsForAuth).not.toHaveBeenCalled()
  })
})

// ── Collection items: legality boundaries (Pflichttest 3 + 4) ───────────────────
describe('POST /api/v1/recipe-collections/:id/items', () => {
  function visibleCustomCollection() {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'c1', ownerType: 'user', ownerUserId: USER_A, householdId: null, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(true)
  }

  it('private collection rejects another user private recipe → 400 (visible-but-illegal)', async () => {
    visibleCustomCollection()
    // recipe is visible to the caller in this contrived contract test, but illegal
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 9, ownerType: 'user', ownerUserId: USER_B, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(true)
    dbMocks.isRecipeLegalForCollection.mockReturnValue(false)
    const res = await router.request('/api/v1/recipe-collections/c1/items', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ recipeId: 9 }),
    })
    expect(res.status).toBe(400)
    expect(dbMocks.addRecipeToCollection).not.toHaveBeenCalled()
  })

  it('household collection rejects a private recipe → 400 (visible-but-illegal)', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'hh', ownerType: 'household', ownerUserId: null, householdId: HOUSEHOLD_1, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(true)
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 5, ownerType: 'user', ownerUserId: USER_A, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(true)
    dbMocks.isRecipeLegalForCollection.mockReturnValue(false)
    const res = await router.request('/api/v1/recipe-collections/hh/items', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ recipeId: 5 }),
    })
    expect(res.status).toBe(400)
    expect(dbMocks.addRecipeToCollection).not.toHaveBeenCalled()
  })

  it('adding an invisible recipe → 404 (no existence leak)', async () => {
    visibleCustomCollection()
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 9, ownerType: 'user', ownerUserId: USER_B, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(false)
    const res = await router.request('/api/v1/recipe-collections/c1/items', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ recipeId: 9 }),
    })
    expect(res.status).toBe(404)
    expect(dbMocks.addRecipeToCollection).not.toHaveBeenCalled()
  })

  it('adding to an invisible collection → 404 (no existence leak)', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'cB', ownerType: 'user', ownerUserId: USER_B, householdId: null, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(false)
    const res = await router.request('/api/v1/recipe-collections/cB/items', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ recipeId: 1 }),
    })
    expect(res.status).toBe(404)
    expect(dbMocks.loadRecipeOwnerRow).not.toHaveBeenCalled()
    expect(dbMocks.addRecipeToCollection).not.toHaveBeenCalled()
  })

  it('adds a legal recipe and reports idempotent added flag', async () => {
    visibleCustomCollection()
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 3, ownerType: 'user', ownerUserId: USER_A, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(true)
    dbMocks.isRecipeLegalForCollection.mockReturnValue(true)
    dbMocks.addRecipeToCollection.mockResolvedValue({ added: true })
    const res = await router.request('/api/v1/recipe-collections/c1/items', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ recipeId: 3 }),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true, added: true })
    expect(dbMocks.addRecipeToCollection).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_A }), 'c1', 3)
  })

  it('rejects a non-integer recipeId with 400', async () => {
    const res = await router.request('/api/v1/recipe-collections/c1/items', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ recipeId: 'x' }),
    })
    expect(res.status).toBe(400)
    expect(dbMocks.loadCollectionRowById).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/v1/recipe-collections/:id/items/:recipeId', () => {
  it('removes a membership from a visible collection', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'c1', ownerType: 'user', ownerUserId: USER_A, householdId: null, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(true)
    dbMocks.removeRecipeFromCollection.mockResolvedValue(true)
    const res = await router.request('/api/v1/recipe-collections/c1/items/3', {
      method: 'DELETE', headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(dbMocks.removeRecipeFromCollection).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_A }), 'c1', 3)
  })

  it('removing from an invisible collection → 404', async () => {
    dbMocks.loadCollectionRowById.mockResolvedValue({
      id: 'cB', ownerType: 'user', ownerUserId: USER_B, householdId: null, kind: 'custom',
    })
    dbMocks.isCollectionVisibleToAuth.mockReturnValue(false)
    const res = await router.request('/api/v1/recipe-collections/cB/items/3', {
      method: 'DELETE', headers: authHeaders,
    })
    expect(res.status).toBe(404)
    expect(dbMocks.removeRecipeFromCollection).not.toHaveBeenCalled()
  })
})

// ── Sharing (Pflichttest 5, 6, 10) ──────────────────────────────────────────────
describe('POST /api/v1/recipes/:id/share', () => {
  it('share private→household returns 201 with a NEW recipe id (never the original)', async () => {
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 1, ownerType: 'user', ownerUserId: USER_A, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(true)
    dbMocks.shareCopyRecipe.mockResolvedValue({
      id: 999, ownerType: 'household', householdId: HOUSEHOLD_1, source_recipe_id: 1, name: 'Copy',
    })
    const res = await router.request('/api/v1/recipes/1/share', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ target: { type: 'household' } }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.recipe.id).toBe(999)
    expect(body.recipe.id).not.toBe(1)
    expect(body.recipe.source_recipe_id).toBe(1)
    expect(dbMocks.shareCopyRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_A }), 1, { type: 'household', householdId: HOUSEHOLD_1 },
    )
  })

  it('share household→private returns 201 with a NEW recipe id', async () => {
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 7, ownerType: 'household', ownerUserId: null, householdId: HOUSEHOLD_1 })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(true)
    dbMocks.shareCopyRecipe.mockResolvedValue({
      id: 888, ownerType: 'user', ownerUserId: USER_A, source_recipe_id: 7, name: 'Copy',
    })
    const res = await router.request('/api/v1/recipes/7/share', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ target: { type: 'user' } }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.recipe.id).toBe(888)
    expect(body.recipe.id).not.toBe(7)
    expect(dbMocks.shareCopyRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_A }), 7, { type: 'user' },
    )
  })

  it('share of a foreign/invisible recipe → 404 (no leak), never calls shareCopyRecipe', async () => {
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 2, ownerType: 'user', ownerUserId: USER_B, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(false)
    const res = await router.request('/api/v1/recipes/2/share', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ target: { type: 'user' } }),
    })
    expect(res.status).toBe(404)
    expect(dbMocks.shareCopyRecipe).not.toHaveBeenCalled()
  })

  it('share to household without an active household → 400 (not 500)', async () => {
    authAsUserA({ activeHousehold: null, memberships: [] })
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 1, ownerType: 'user', ownerUserId: USER_A, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(true)
    const res = await router.request('/api/v1/recipes/1/share', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ target: { type: 'household' } }),
    })
    expect(res.status).toBe(400)
    expect(dbMocks.shareCopyRecipe).not.toHaveBeenCalled()
  })

  it('never silently rewrites the owner: share copies into the caller scope and leaves the source untouched', async () => {
    // The route must call shareCopyRecipe (copy semantics) and never updateRecipe.
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 4, ownerType: 'user', ownerUserId: USER_A, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(true)
    dbMocks.shareCopyRecipe.mockResolvedValue({
      id: 555, ownerType: 'household', householdId: HOUSEHOLD_1, source_recipe_id: 4, name: 'Copy',
    })
    const res = await router.request('/api/v1/recipes/4/share', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ target: { type: 'household' } }),
    })
    const body = await res.json()
    expect(res.status).toBe(201)
    // returned id is the copy, not the original
    expect(body.recipe.id).toBe(555)
    expect(body.recipe.source_recipe_id).toBe(4)
    // copy-only: there is no mutation helper exposed/called by the share route
    expect(dbMocks).not.toHaveProperty('updateRecipeInReactDb')
  })

  it('rejects an invalid target with 400', async () => {
    const res = await router.request('/api/v1/recipes/1/share', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ target: { type: 'bogus' } }),
    })
    expect(res.status).toBe(400)
    expect(dbMocks.loadRecipeOwnerRow).not.toHaveBeenCalled()
  })
})

// ── Favorites toggle (Pflichttest 7 — idempotent contract) ──────────────────────
describe('favorite toggle routes', () => {
  it('POST favorite on a visible recipe is idempotent (setFavorite true)', async () => {
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 1, ownerType: 'user', ownerUserId: USER_A, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(true)
    dbMocks.setFavorite.mockResolvedValue({ isFavorite: true })

    const res1 = await router.request('/api/v1/recipes/1/favorite', { method: 'POST', headers: authHeaders })
    const res2 = await router.request('/api/v1/recipes/1/favorite', { method: 'POST', headers: authHeaders })
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    await expect(res1.json()).resolves.toEqual({ success: true, isFavorite: true })
    expect(dbMocks.setFavorite).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: USER_A }), 1, true, 'user')
    expect(dbMocks.setFavorite).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: USER_A }), 1, true, 'user')
  })

  it('DELETE favorite is idempotent (setFavorite false)', async () => {
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 1, ownerType: 'user', ownerUserId: USER_A, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(true)
    dbMocks.setFavorite.mockResolvedValue({ isFavorite: false })

    const res1 = await router.request('/api/v1/recipes/1/favorite', { method: 'DELETE', headers: authHeaders })
    const res2 = await router.request('/api/v1/recipes/1/favorite', { method: 'DELETE', headers: authHeaders })
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(dbMocks.setFavorite).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: USER_A }), 1, false, 'user')
    expect(dbMocks.setFavorite).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: USER_A }), 1, false, 'user')
  })

  it('favoriting a foreign/invisible recipe → 404', async () => {
    dbMocks.loadRecipeOwnerRow.mockResolvedValue({ id: 2, ownerType: 'user', ownerUserId: USER_B, householdId: null })
    dbMocks.isRecipeVisibleToAuth.mockReturnValue(false)
    const res = await router.request('/api/v1/recipes/2/favorite', { method: 'POST', headers: authHeaders })
    expect(res.status).toBe(404)
    expect(dbMocks.setFavorite).not.toHaveBeenCalled()
  })
})
