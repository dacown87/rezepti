import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as cheerio from 'cheerio'
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { findOriginalUrl, extractPinMetadata, hasRecipeKeywords, extractRecipeKeywords, extractImagesFromHtml } from '../../src/fetchers/pinterest.js'

vi.mock('../../src/fetchers/web.js', () => ({
  fetchWeb: vi.fn(),
}))

const TEST_CREDENTIALS_FILE = join(process.cwd(), 'data', 'pinterest-credentials-test.json')

describe('pinterest-fetcher', () => {
  describe('findOriginalUrl', () => {
    it('finds original link from carousel anchor', () => {
      const html = `
        <html>
          <body>
            <a data-test-id="pin-carousel-original-link" href="https://example.com/recipe">Original Recipe</a>
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBe('https://example.com/recipe')
    })

    it('finds original link from anchor with rel=noopener', () => {
      const html = `
        <html>
          <body>
            <a href="https://chefkoch.de/rezept/1234" rel="noopener noreferrer">Recipe</a>
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBe('https://chefkoch.de/rezept/1234')
    })

    it('finds original URL from og:see_also meta tag', () => {
      const html = `
        <html>
          <head>
            <meta property="og:see_also" content="https://example.com/rezepte/pasta" />
          </head>
          <body></body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBe('https://example.com/rezepte/pasta')
    })

    it('finds original URL from name og:see_also meta tag', () => {
      const html = `
        <html>
          <head>
            <meta name="og:see_also" content="https://example.com/recipe" />
          </head>
          <body></body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBe('https://example.com/recipe')
    })

    it('filters out pinterest.com URLs', () => {
      const html = `
        <html>
          <body>
            <a href="https://www.pinterest.com/pin/123">Pinterest</a>
            <a href="https://www.pinterest.com/pin/456">Another Pinterest</a>
            <a href="https://example.com/recipe" rel="noopener">Real Recipe</a>
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBe('https://example.com/recipe')
    })

    it('falls back to body text URL search', () => {
      const html = `
        <html>
          <body>
            Check out this great recipe at https://example.com/lasagna
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBe('https://example.com/lasagna')
    })

    it('filters out pinterest URLs in body text fallback', () => {
      const html = `
        <html>
          <body>
            Visit https://www.pinterest.com/pin/12345 or https://example.com/real-recipe
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBe('https://example.com/real-recipe')
    })

    it('returns null when no original URL found', () => {
      const html = `
        <html>
          <body>
            <p>This is just a regular pin without a recipe link.</p>
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBeNull()
    })

    it('ignores non-http URLs', () => {
      const html = `
        <html>
          <body>
            <a href="/relative/path">Relative</a>
            <a href="ftp://files.example.com/recipe">FTP</a>
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBeNull()
    })

    it('prefers explicit selectors over body text fallback', () => {
      const html = `
        <html>
          <body>
            <a href="https://real-recipe.com/rezept" rel="noopener">Recipe</a>
            Also check https://fake-link.com/notecipe in the text.
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBe('https://real-recipe.com/rezept')
    })
  })

  describe('extractPinMetadata', () => {
    it('extracts og:title and og:description', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Leckeres Pasta Rezept" />
            <meta property="og:description" content="Ein schnelles Abendessen" />
            <meta property="og:image" content="https://example.com/pasta.jpg" />
          </head>
          <body></body>
        </html>
      `
      const $ = cheerio.load(html)
      const result = extractPinMetadata($, html)
      expect(result.title).toBe('Leckeres Pasta Rezept')
      expect(result.description).toBe('Ein schnelles Abendessen')
      expect(result.imageUrl).toBe('https://example.com/pasta.jpg')
    })

    it('falls back to twitter meta tags', () => {
      const html = `
        <html>
          <head>
            <meta name="twitter:title" content="Twitter Title" />
            <meta name="twitter:description" content="Twitter Description" />
            <meta name="twitter:image" content="https://example.com/twitter-img.jpg" />
          </head>
          <body></body>
        </html>
      `
      const $ = cheerio.load(html)
      const result = extractPinMetadata($, html)
      expect(result.title).toBe('Twitter Title')
      expect(result.description).toBe('Twitter Description')
      expect(result.imageUrl).toBe('https://example.com/twitter-img.jpg')
    })

    it('falls back to title tag and meta description', () => {
      const html = `
        <html>
          <head>
            <meta name="description" content="Meta description text" />
          </head>
          <body>
            <title>Fallback Title</title>
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      const result = extractPinMetadata($, html)
      expect(result.title).toBe('Fallback Title')
      expect(result.description).toBe('Meta description text')
    })

    it('handles missing meta tags gracefully', () => {
      const html = `<html><head></head><body></body></html>`
      const $ = cheerio.load(html)
      const result = extractPinMetadata($, html)
      expect(result.title).toBe('')
      expect(result.description).toBe('')
      expect(result.imageUrl).toBeNull()
    })

    it('extracts twitter:image:src as fallback', () => {
      const html = `
        <html>
          <head>
            <meta name="twitter:image:src" content="https://example.com/twitter-src.jpg" />
          </head>
          <body></body>
        </html>
      `
      const $ = cheerio.load(html)
      const result = extractPinMetadata($, html)
      expect(result.imageUrl).toBe('https://example.com/twitter-src.jpg')
    })

    it('prioritizes og: over twitter: for image', () => {
      const html = `
        <html>
          <head>
            <meta property="og:image" content="https://example.com/og-image.jpg" />
            <meta name="twitter:image" content="https://example.com/twitter-image.jpg" />
          </head>
          <body></body>
        </html>
      `
      const $ = cheerio.load(html)
      const result = extractPinMetadata($, html)
      expect(result.imageUrl).toBe('https://example.com/og-image.jpg')
    })
  })

  describe('hasRecipeKeywords', () => {
    it('detects German recipe keywords', () => {
      expect(hasRecipeKeywords('Zutaten: Mehl, Eier, Milch')).toBe(true)
      expect(hasRecipeKeywords('Zubereitung: Schritt für Schritt')).toBe(true)
      expect(hasRecipeKeywords('Rezept für Pasta')).toBe(true)
    })

    it('detects English recipe keywords', () => {
      expect(hasRecipeKeywords('Ingredients: 500g flour')).toBe(true)
      expect(hasRecipeKeywords('Instructions for cooking')).toBe(true)
      expect(hasRecipeKeywords('Prep time: 15 min')).toBe(true)
    })

    it('returns false for non-recipe text', () => {
      expect(hasRecipeKeywords('Leckeres Essen macht Freude')).toBe(false)
      expect(hasRecipeKeywords('Schönes Wetter heute')).toBe(false)
    })

    it('is case insensitive', () => {
      expect(hasRecipeKeywords('ZUTATEN: Mehl')).toBe(true)
      expect(hasRecipeKeywords('zutaten: Mehl')).toBe(true)
    })
  })

  describe('extractRecipeKeywords', () => {
    it('extracts multiple matching keywords', () => {
      const text = 'Zutaten: Mehl, Zucker. Zubereitung: Mischen und backen.'
      const result = extractRecipeKeywords(text)
      expect(result).toContain('Zutaten')
      expect(result).toContain('Zubereitung')
    })

    it('returns empty array for no matches', () => {
      expect(extractRecipeKeywords('Nur allgemeiner Text')).toEqual([])
    })

    it('detects both German and English keywords', () => {
      const text = 'Ingredients and Zubereitung'
      const result = extractRecipeKeywords(text)
      expect(result).toContain('Ingredients')
      expect(result).toContain('Zubereitung')
    })
  })

  describe('extractImagesFromHtml', () => {
    it('extracts images from img src attributes', () => {
      const html = `
        <html>
          <body>
            <img src="https://example.com/image1.jpg" />
            <img src="https://example.com/image2.png" />
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      const images = extractImagesFromHtml($, 'https://pinterest.com')
      expect(images).toContain('https://example.com/image1.jpg')
      expect(images).toContain('https://example.com/image2.png')
    })

    it('extracts from data-src attributes', () => {
      const html = `
        <html>
          <body>
            <img data-src="https://example.com/lazy.jpg" />
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      const images = extractImagesFromHtml($, 'https://pinterest.com')
      expect(images).toContain('https://example.com/lazy.jpg')
    })

    it('extracts from data-pin-img attributes', () => {
      const html = `
        <html>
          <body>
            <img data-pin-img="https://example.com/pin-img.jpg" />
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      const images = extractImagesFromHtml($, 'https://pinterest.com')
      expect(images).toContain('https://example.com/pin-img.jpg')
    })

    it('filters out invalid URLs', () => {
      const html = `
        <html>
          <body>
            <img src="not-a-valid-url" />
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      const images = extractImagesFromHtml($, 'https://pinterest.com')
      expect(images).not.toContain('not-a-valid-url')
    })

    it('deduplicates images', () => {
      const html = `
        <html>
          <body>
            <img src="https://example.com/same.jpg" />
            <img src="https://example.com/same.jpg" />
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      const images = extractImagesFromHtml($, 'https://pinterest.com')
      expect(images.filter(i => i === 'https://example.com/same.jpg')).toHaveLength(1)
    })

    it('limits to 10 images', () => {
      const imgTags = Array.from({ length: 15 }, (_, i) => 
        `<img src="https://example.com/image${i}.jpg" />`
      ).join('')
      const html = `<html><body>${imgTags}</body></html>`
      const $ = cheerio.load(html)
      const images = extractImagesFromHtml($, 'https://pinterest.com')
      expect(images.length).toBeLessThanOrEqual(10)
    })
  })
})
