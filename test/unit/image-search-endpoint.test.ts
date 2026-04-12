import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchRecipeImages } from '../../src/utils/image-search.js'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(response: { ok: boolean; json?: () => Promise<unknown> }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

describe('GET /api/v1/images/search endpoint logic', () => {
  it('returns up to 4 image URLs for a valid search query', async () => {
    const results = Array.from({ length: 6 }, (_, i) => ({
      previewImageUrl: `https://img.chefkoch.de/recipe${i + 1}.jpg`,
    }))
    mockFetch({ ok: true, json: async () => ({ results }) })

    const urls = await searchRecipeImages('Bolognese')

    expect(urls).toHaveLength(4)
  })

  it('returns empty array when query is empty', async () => {
    mockFetch({ ok: true, json: async () => ({ results: [] }) })

    const urls = await searchRecipeImages('')

    expect(urls).toEqual([])
  })

  it('returns empty array on Chefkoch API timeout/network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))

    const urls = await searchRecipeImages('Suppe')

    expect(urls).toEqual([])
  })
})