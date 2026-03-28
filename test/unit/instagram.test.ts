import { describe, it, expect } from 'vitest'
import { extractHashtags, detectCarousel, tempDirFromFilename } from '../../src/fetchers/instagram.js'

describe('instagram-fetcher', () => {
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

  describe('detectCarousel', () => {
    it('detects carousel by media_count > 1', () => {
      expect(detectCarousel({ media_count: 5 })).toBe(true)
      expect(detectCarousel({ media_count: 1 })).toBeFalsy()
      expect(detectCarousel({ media_count: 0 })).toBeFalsy()
    })

    it('detects carousel by CAROUSEL_ALBUM media_type', () => {
      expect(detectCarousel({ media_type: 'CAROUSEL_ALBUM' })).toBe(true)
      expect(detectCarousel({ media_type: 'VIDEO' })).toBeFalsy()
      expect(detectCarousel({ media_type: 'IMAGE' })).toBeFalsy()
    })

    it('detects carousel by children array with length > 1', () => {
      expect(detectCarousel({ children: ['img1', 'img2', 'img3'] })).toBe(true)
      expect(detectCarousel({ children: ['img1'] })).toBe(true)
      expect(detectCarousel({ children: [] })).toBeFalsy()
    })

    it('returns falsy for empty object', () => {
      expect(detectCarousel({})).toBeFalsy()
    })

    it('handles mixed conditions', () => {
      expect(detectCarousel({ media_count: 1, media_type: 'CAROUSEL_ALBUM' })).toBe(true)
    })
  })

  describe('tempDirFromFilename', () => {
    it('extracts directory from filename', () => {
      expect(tempDirFromFilename('/path/to/file.jpg')).toBe('/path/to/file')
    })

    it('handles filename with multiple dots', () => {
      expect(tempDirFromFilename('/path/to/file.name.jpg')).toBe('/path/to/file.name')
    })

    it('handles filename without extension', () => {
      expect(tempDirFromFilename('/path/to/file')).toBe('/path/to/file')
    })

    it('handles simple filename', () => {
      expect(tempDirFromFilename('file.txt')).toBe('file')
    })

    it('handles path without file', () => {
      expect(tempDirFromFilename('.')).toBe('.')
    })
  })
})
