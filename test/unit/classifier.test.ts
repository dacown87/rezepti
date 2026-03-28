import { describe, it, expect } from 'vitest'
import { classifyURL } from '../../src/classifier.js'

describe('classifier', () => {
  describe('TikTok URL classification', () => {
    it('classifies standard tiktok.com URL', () => {
      const result = classifyURL('https://www.tiktok.com/@user/video/123456789')
      expect(result.type).toBe('tiktok')
      expect(result.url).toBe('https://www.tiktok.com/@user/video/123456789')
    })

    it('classifies vm.tiktok.com short URL', () => {
      const result = classifyURL('https://vm.tiktok.com/ZMhxyz123')
      expect(result.type).toBe('tiktok')
      expect(result.url).toBe('https://vm.tiktok.com/ZMhxyz123')
    })

    it('classifies vt.tiktok.com short URL', () => {
      const result = classifyURL('https://vt.tiktok.com/ABCdef456')
      expect(result.type).toBe('tiktok')
    })

    it('classifies tiktok.com with www', () => {
      const result = classifyURL('https://www.tiktok.com/discover/food')
      expect(result.type).toBe('tiktok')
    })

    it('tiktok URL with query parameters', () => {
      const result = classifyURL('https://www.tiktok.com/@chef/recipe?lang=de')
      expect(result.type).toBe('tiktok')
    })

    it('tiktok URL case insensitive', () => {
      const result = classifyURL('https://WWW.TIKTOK.COM/@user/video/123')
      expect(result.type).toBe('tiktok')
    })
  })

  describe('Other platform classification', () => {
    it('classifies YouTube URL', () => {
      const result = classifyURL('https://www.youtube.com/watch?v=abc123')
      expect(result.type).toBe('youtube')
    })

    it('classifies YouTube short URL', () => {
      const result = classifyURL('https://youtu.be/abc123')
      expect(result.type).toBe('youtube')
    })

    it('classifies Instagram URL', () => {
      const result = classifyURL('https://www.instagram.com/p/ABC123/')
      expect(result.type).toBe('instagram')
    })

    it('classifies Cookidoo URL', () => {
      const result = classifyURL('https://www.cookidoo.de/rezept/123456')
      expect(result.type).toBe('cookidoo')
    })

    it('classifies Chefkoch URL', () => {
      const result = classifyURL('https://www.chefkoch.de/rezepte/123456/')
      expect(result.type).toBe('chefkoch')
    })

    it('classifies Pinterest URL', () => {
      const result = classifyURL('https://www.pinterest.com/pin/123456/')
      expect(result.type).toBe('pinterest')
    })

    it('classifies Facebook URL', () => {
      const result = classifyURL('https://www.facebook.com/recipe/123456')
      expect(result.type).toBe('facebook')
    })
  })

  describe('Default web classification', () => {
    it('classifies unknown URL as web', () => {
      const result = classifyURL('https://www.example.com/recipe')
      expect(result.type).toBe('web')
    })

    it('preserves original URL for web', () => {
      const result = classifyURL('https://www.example.com/recipe')
      expect(result.url).toBe('https://www.example.com/recipe')
    })
  })

  describe('Invalid URL handling', () => {
    it('throws error for invalid URL', () => {
      expect(() => classifyURL('not-a-url')).toThrow('Ungültige URL')
    })

    it('trims whitespace from URL', () => {
      const result = classifyURL('  https://www.tiktok.com/@user  ')
      expect(result.type).toBe('tiktok')
      expect(result.url).toBe('https://www.tiktok.com/@user')
    })
  })

  describe('URL priority', () => {
    it('matches tiktok before generic web patterns', () => {
      // Even though tiktok.com is a website, it should be classified as tiktok
      const result = classifyURL('https://www.tiktok.com/@chef/recipes/pasta')
      expect(result.type).toBe('tiktok')
    })
  })
})
