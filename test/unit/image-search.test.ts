import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchRecipeImages } from '../../src/utils/image-search.js'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(response: { ok: boolean; json?: () => Promise<unknown> }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

describe('searchRecipeImages', () => {
  it('returns up to 4 image URLs from 6 API results', async () => {
    const results = Array.from({ length: 6 }, (_, i) => ({
      previewImageUrl: `https://img.chefkoch.de/recipe${i + 1}.jpg`,
    }))
    mockFetch({ ok: true, json: async () => ({ results }) })

    const urls = await searchRecipeImages('Spaghetti Bolognese')

    expect(urls).toHaveLength(4)
    expect(urls[0]).toBe('https://img.chefkoch.de/recipe1.jpg')
    expect(urls[3]).toBe('https://img.chefkoch.de/recipe4.jpg')
  })

  it('returns [] when API results are empty', async () => {
    mockFetch({ ok: true, json: async () => ({ results: [] }) })

    const urls = await searchRecipeImages('Unbekanntes Rezept')

    expect(urls).toEqual([])
  })

  it('returns [] on non-OK response (e.g. 500)', async () => {
    mockFetch({ ok: false })

    const urls = await searchRecipeImages('Lasagne')

    expect(urls).toEqual([])
  })

  it('returns [] when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const urls = await searchRecipeImages('Gulasch')

    expect(urls).toEqual([])
  })

  it('filters out entries without previewImageUrl', async () => {
    const results = [
      { previewImageUrl: 'https://img.chefkoch.de/valid.jpg' },
      { previewImageUrl: null },
      { previewImageUrl: '' },
      { title: 'no image here' },
    ]
    mockFetch({ ok: true, json: async () => ({ results }) })

    const urls = await searchRecipeImages('Schnitzel')

    expect(urls).toEqual(['https://img.chefkoch.de/valid.jpg'])
  })

  it('calls the Chefkoch API with the encoded recipe name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await searchRecipeImages('Käse Spätzle')

    const calledUrl: string = fetchMock.mock.calls[0][0]
    expect(calledUrl).toContain('K%C3%A4se%20Sp%C3%A4tzle')
    expect(calledUrl).toContain('limit=6')
    expect(calledUrl).toContain('sortBy=relevance')
  })
})
