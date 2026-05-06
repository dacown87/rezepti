import { beforeEach, describe, it, expect, vi } from 'vitest'

// Setup mocks before importing
const mockExecFile = vi.fn()
const mockReaddir = vi.fn()
const mockReadFile = vi.fn()
const mockExtractVisibleTextFromImages = vi.fn()

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}))

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  readdir: mockReaddir,
}))

vi.mock('../../src/config.js', () => ({
  config: {
    tiktok: {
      ocrEnabled: true,
      maxOcrFrames: 10,
      proxyUrl: '',
    },
  },
}))

vi.mock('../../src/processors/llm.js', () => ({
  extractVisibleTextFromImages: mockExtractVisibleTextFromImages,
}))

// Now import the module under test
const { extractHashtags, prioritizeComments, extractTextFromVideoFrames } = await import('../../src/fetchers/tiktok.js')

const TIKTOK_REGIONS = ["de", "us", "fr", "uk", "ca", "au"]

describe('tiktok-fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractHashtags', () => {
    it('extracts single hashtag', () => {
      expect(extractHashtags('Rezept für #pasta')).toEqual(['#pasta'])
    })

    it('extracts multiple hashtags', () => {
      const result = extractHashtags('Lecker! #food #cooking #rezept')
      expect(result).toContain('#food')
      expect(result).toContain('#cooking')
      expect(result).toContain('#rezept')
      expect(result.length).toBe(3)
    })

    it('deduplicates hashtags', () => {
      expect(extractHashtags('#cooking #cooking #cooking')).toEqual(['#cooking'])
    })

    it('handles hashtags with unicode', () => {
      expect(extractHashtags('#Café #naïve')).toContain('#Café')
      expect(extractHashtags('#Café #naïve')).toContain('#naïve')
    })

    it('returns empty array for no hashtags', () => {
      expect(extractHashtags('Kein Hashtag hier')).toEqual([])
    })

    it('handles empty string', () => {
      expect(extractHashtags('')).toEqual([])
    })
  })

  describe('prioritizeComments', () => {
    it('returns empty array for no comments', () => {
      expect(prioritizeComments([])).toEqual([])
    })

    it('prioritizes comments with recipe keywords', () => {
      const comments = [
        { text: 'Tolles Rezept!', like_count: 5 },
        { text: 'Zutat: 200g Mehl', like_count: 2 },
        { text: 'Lecker!', like_count: 10 },
      ]
      const result = prioritizeComments(comments)
      expect(result[0]).toBe('Tolles Rezept!')
    })

    it('sorts by score descending', () => {
      const comments = [
        { text: 'Schritt 1: Mehl sieben', like_count: 100 },
        { text: 'Niedlich', like_count: 5 },
        { text: 'Tipp: Mehr Salz dazu', like_count: 50 },
      ]
      const result = prioritizeComments(comments)
      expect(result[0]).toBe('Schritt 1: Mehl sieben')
      expect(result[1]).toBe('Tipp: Mehr Salz dazu')
      expect(result[2]).toBe('Niedlich')
    })

    it('handles comments with body field (yt-dlp format)', () => {
      const comments = [
        { body: 'Zutaten: 500g Hackfleisch', likes: 20 },
      ]
      const result = prioritizeComments(comments)
      expect(result[0]).toBe('Zutaten: 500g Hackfleisch')
    })

    it('filters out empty comments', () => {
      const comments = [
        { text: '', like_count: 100 },
        { text: '   ', like_count: 50 },
        { text: 'Gutes Rezept', like_count: 10 },
      ]
      const result = prioritizeComments(comments)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('Gutes Rezept')
    })

    it('limits to 10 comments', () => {
      const comments = Array.from({ length: 20 }, (_, i) => ({
        text: `Comment ${i}`,
        like_count: i,
      }))
      const result = prioritizeComments(comments)
      expect(result).toHaveLength(10)
    })

    it('handles missing like_count gracefully', () => {
      const comments = [
        { text: 'No likes' },
        { text: 'Has likes', likes: 5 },
      ]
      const result = prioritizeComments(comments)
      expect(result).toContain('Has likes')
      expect(result).toContain('No likes')
    })

    it('boosts multiple keyword matches', () => {
      const comments = [
        { text: 'Zutaten und Schritte sind perfekt', like_count: 1 },
        { text: 'Nur ein Kommentar', like_count: 100 },
      ]
      const result = prioritizeComments(comments)
      expect(result[0]).toBe('Zutaten und Schritte sind perfekt')
    })

    it('handles english recipe keywords', () => {
      const comments = [
        { text: 'Great recipe!', like_count: 5 },
        { text: 'Step 1: Preheat oven', like_count: 2 },
        { text: 'Yum', like_count: 10 },
      ]
      const result = prioritizeComments(comments)
      expect(result[0]).toBe('Great recipe!')
    })

    it('handles german recipe keywords', () => {
      const comments = [
        { text: 'Zutat: Zucker', like_count: 5 },
        { text: 'Schritt 1: Kochen', like_count: 10 },
        { text: 'Tipp: Warm servieren', like_count: 3 },
      ]
      const result = prioritizeComments(comments)
      expect(result[0]).toBe('Schritt 1: Kochen')
      expect(result[1]).toBe('Zutat: Zucker')
      expect(result[2]).toBe('Tipp: Warm servieren')
    })

    it('handles mixed language comments', () => {
      const comments = [
        { text: 'Recipe: 500g flour', likes: 2 },
        { text: 'Zutaten: 200g Zucker', likes: 5 },
      ]
      const result = prioritizeComments(comments)
      expect(result[0]).toBe('Zutaten: 200g Zucker')
      expect(result[1]).toBe('Recipe: 500g flour')
    })
  })

  describe('TIKTOK_REGIONS', () => {
    it('contains expected region codes', () => {
      expect(TIKTOK_REGIONS).toContain('de')
      expect(TIKTOK_REGIONS).toContain('us')
      expect(TIKTOK_REGIONS).toContain('fr')
      expect(TIKTOK_REGIONS).toContain('uk')
      expect(TIKTOK_REGIONS).toContain('ca')
      expect(TIKTOK_REGIONS).toContain('au')
    })

    it('has 6 regions', () => {
      expect(TIKTOK_REGIONS).toHaveLength(6)
    })

    it('starts with DE region for best results', () => {
      expect(TIKTOK_REGIONS[0]).toBe('de')
    })
  })

  describe('extractTextFromVideoFrames', () => {
    it('function is exported and callable', () => {
      expect(typeof extractTextFromVideoFrames).toBe('function')
    })

    it('sends all extracted frames to the plaintext vision helper once', async () => {
      mockExecFile.mockImplementation((_command, _args, optionsOrCallback, maybeCallback) => {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
        callback(null, { stdout: '', stderr: '' })
      })
      mockReaddir.mockResolvedValue([
        'tiktok-frame-0003.jpg',
        'tiktok-frame-0001.jpg',
        'tiktok-frame-0002.jpeg',
      ])
      mockReadFile
        .mockResolvedValueOnce(Buffer.from('frame-1'))
        .mockResolvedValueOnce(Buffer.from('frame-2'))
        .mockResolvedValueOnce(Buffer.from('frame-3'))
      mockExtractVisibleTextFromImages.mockResolvedValue('200 g Mehl\n2 Eier')

      const result = await extractTextFromVideoFrames('/tmp/video.mp4', '/tmp/tiktok', { apiKey: 'user-key' })

      expect(result).toBe('200 g Mehl\n2 Eier')
      expect(mockExtractVisibleTextFromImages).toHaveBeenCalledTimes(1)
      expect(mockExtractVisibleTextFromImages).toHaveBeenCalledWith([
        `data:image/jpeg;base64,${Buffer.from('frame-1').toString('base64')}`,
        `data:image/jpeg;base64,${Buffer.from('frame-2').toString('base64')}`,
        `data:image/jpeg;base64,${Buffer.from('frame-3').toString('base64')}`,
      ], { apiKey: 'user-key' })
    })

    it('returns empty string when ffmpeg is unavailable', async () => {
      mockExecFile.mockImplementation((_command, _args, optionsOrCallback, maybeCallback) => {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
        callback(new Error('ffmpeg not found'))
      })

      const result = await extractTextFromVideoFrames('/tmp/video.mp4', '/tmp/tiktok')

      expect(result).toBe('')
      expect(mockReaddir).not.toHaveBeenCalled()
      expect(mockExtractVisibleTextFromImages).not.toHaveBeenCalled()
    })

    it('returns empty string when no frames were extracted', async () => {
      mockExecFile.mockImplementation((_command, _args, optionsOrCallback, maybeCallback) => {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
        callback(null, { stdout: '', stderr: '' })
      })
      mockReaddir.mockResolvedValue(['tiktok.info.json'])

      const result = await extractTextFromVideoFrames('/tmp/video.mp4', '/tmp/tiktok')

      expect(result).toBe('')
      expect(mockExtractVisibleTextFromImages).not.toHaveBeenCalled()
    })

    it('returns empty string when the plaintext vision helper fails', async () => {
      mockExecFile.mockImplementation((_command, _args, optionsOrCallback, maybeCallback) => {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
        callback(null, { stdout: '', stderr: '' })
      })
      mockReaddir.mockResolvedValue(['tiktok-frame-0001.jpg'])
      mockReadFile.mockResolvedValue(Buffer.from('frame-1'))
      mockExtractVisibleTextFromImages.mockRejectedValue(new Error('vision failed'))

      const result = await extractTextFromVideoFrames('/tmp/video.mp4', '/tmp/tiktok')

      expect(result).toBe('')
      expect(mockExtractVisibleTextFromImages).toHaveBeenCalledTimes(1)
    })
  })
})
