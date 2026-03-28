import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process before importing the module
const mockExecFile = vi.fn()

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  rm: vi.fn(),
}))

vi.mock('../../src/config.js', () => ({
  config: {
    facebook: {
      username: '',
      password: '',
    },
  },
}))

// Import after mocks are set up
const { 
  isFacebookVideoUrl, 
  extractHashtags, 
  extractOpenGraphMetadata,
  detectReel 
} = await import('../../src/fetchers/facebook.js')

describe('facebook-fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isFacebookVideoUrl', () => {
    it('should detect video URLs with /videos/', () => {
      expect(isFacebookVideoUrl('https://www.facebook.com/user/videos/123456789')).toBe(true)
    })

    it('should detect video URLs with /video/', () => {
      expect(isFacebookVideoUrl('https://www.facebook.com/video.php?v=123456789')).toBe(true)
    })

    it('should detect watch URLs', () => {
      expect(isFacebookVideoUrl('https://www.facebook.com/watch?v=123456789')).toBe(true)
    })

    it('should detect fb.watch URLs', () => {
      expect(isFacebookVideoUrl('https://fb.watch/abc123')).toBe(true)
    })

    it('should detect reel URLs', () => {
      expect(isFacebookVideoUrl('https://www.facebook.com/reel/123456789')).toBe(true)
    })

    it('should detect story URLs', () => {
      expect(isFacebookVideoUrl('https://www.facebook.com/stories/123456789')).toBe(true)
    })

    it('should reject non-video Facebook URLs', () => {
      expect(isFacebookVideoUrl('https://www.facebook.com/username')).toBe(false)
      expect(isFacebookVideoUrl('https://www.facebook.com/username/posts/123')).toBe(false)
      expect(isFacebookVideoUrl('https://www.facebook.com/username/photos/123')).toBe(false)
      expect(isFacebookVideoUrl('https://www.facebook.com/groups/123456789')).toBe(false)
    })

    it('should reject Facebook URLs without path', () => {
      expect(isFacebookVideoUrl('https://www.facebook.com')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(isFacebookVideoUrl('https://www.FACEBOOK.COM/watch?v=123')).toBe(true)
      expect(isFacebookVideoUrl('https://www.facebook.com/WATCH?v=123')).toBe(true)
      expect(isFacebookVideoUrl('https://WWW.FACEBOOK.COM/REEL/123')).toBe(true)
    })

    it('should handle URLs with query parameters', () => {
      expect(isFacebookVideoUrl('https://www.facebook.com/watch?v=123456789&__cft__[0]=abc')).toBe(true)
      expect(isFacebookVideoUrl('https://fb.watch/abc123?utm_source=facebook')).toBe(true)
    })

    it('should handle URLs with special characters', () => {
      expect(isFacebookVideoUrl('https://www.facebook.com/user/videos/abc-def-123')).toBe(true)
    })

    it('should reject non-Facebook URLs', () => {
      expect(isFacebookVideoUrl('https://youtube.com/watch?v=123')).toBe(false)
      expect(isFacebookVideoUrl('https://instagram.com/p/abc123')).toBe(false)
      expect(isFacebookVideoUrl('https://tiktok.com/@user/video/123')).toBe(false)
    })
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
      const result = extractHashtags('#cooking #cooking #cooking')
      expect(result).toEqual(['#cooking'])
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

    it('handles hashtags at different positions', () => {
      const result = extractHashtags('#start Mitte #ende')
      expect(result).toContain('#start')
      expect(result).toContain('#ende')
    })
  })

  describe('extractOpenGraphMetadata', () => {
    it('extracts title from Open Graph meta', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Leckeres Rezept" />
            <meta property="og:description" content="So geht das Rezept" />
            <meta property="og:image" content="https://example.com/image.jpg" />
          </head>
        </html>
      `
      const result = extractOpenGraphMetadata(html)
      expect(result.title).toBe('Leckeres Rezept')
      expect(result.description).toBe('So geht das Rezept')
      expect(result.image).toBe('https://example.com/image.jpg')
    })

    it('returns null values for missing meta tags', () => {
      const html = '<html><head></head></html>'
      const result = extractOpenGraphMetadata(html)
      expect(result.title).toBeNull()
      expect(result.description).toBeNull()
      expect(result.image).toBeNull()
    })

    it('handles empty string', () => {
      const result = extractOpenGraphMetadata('')
      expect(result.title).toBeNull()
      expect(result.description).toBeNull()
      expect(result.image).toBeNull()
    })

    it('extracts video meta tags', () => {
      const html = `
        <html>
          <head>
            <meta property="og:video" content="https://example.com/video.mp4" />
            <meta property="og:video:secure_url" content="https://secure.example.com/video.mp4" />
            <meta property="og:video:type" content="video/mp4" />
          </head>
        </html>
      `
      const result = extractOpenGraphMetadata(html)
      expect(result.video).toBe('https://example.com/video.mp4')
      expect(result.videoSecureUrl).toBe('https://secure.example.com/video.mp4')
      expect(result.videoType).toBe('video/mp4')
    })

    it('handles multiple og:title tags (takes first)', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="First Title" />
            <meta property="og:title" content="Second Title" />
          </head>
        </html>
      `
      const result = extractOpenGraphMetadata(html)
      expect(result.title).toBe('First Title')
    })
  })

  describe('detectReel', () => {
    it('detects /reel/ path', () => {
      expect(detectReel('https://www.facebook.com/reel/123456789')).toBe(true)
    })

    it('detects /reels/ path', () => {
      expect(detectReel('https://www.facebook.com/reels/123456789')).toBe(true)
    })

    it('returns false for non-reel URLs', () => {
      expect(detectReel('https://www.facebook.com/watch?v=123')).toBe(false)
      expect(detectReel('https://www.facebook.com/user/videos/123')).toBe(false)
    })

    it('is case insensitive', () => {
      expect(detectReel('https://www.facebook.com/REEL/123456789')).toBe(true)
    })
  })

  describe('fetchFacebook function signature', () => {
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('should be exported and callable with url and tempDir', async () => {
      const { fetchFacebook } = await import('../../src/fetchers/facebook.js')
      
      // The function signature requires url and tempDir parameters
      // It will throw a network error when actually called, but we verify the function exists
      expect(typeof fetchFacebook).toBe('function')
    })

    it('should use OG fallback for non-video URLs', async () => {
      // Mock fetch to return test data
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html><head><meta property="og:title" content="Test Title" /></head></html>'
      })
      globalThis.fetch = mockFetch

      const { fetchFacebook } = await import('../../src/fetchers/facebook.js')
      const result = await fetchFacebook('https://www.facebook.com/username', '/tmp/test')
      
      expect(result.type).toBe('facebook')
      expect(result.title).toBe('Test Title')
    })
  })
})
