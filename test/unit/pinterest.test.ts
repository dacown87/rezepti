import { describe, it, expect, vi, afterEach } from 'vitest'
import * as cheerio from 'cheerio'
import {
  findOriginalUrl,
  extractPinMetadata,
  hasRecipeKeywords,
  extractRecipeKeywords,
  extractImagesFromHtml,
  isUsableExternalUrl,
  fetchPinterest,
  PINTEREST_NO_DATA_ERROR,
} from '../../src/fetchers/pinterest.js'

vi.mock('../../src/fetchers/web.js', () => ({
  fetchWeb: vi.fn(),
}))

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

    it('no longer scrapes URLs out of body text', () => {
      // Die frühere Strategie 4 hat jede URL aus dem Body-Text genommen. Bei
      // heutigen Pinterest-Seiten besteht der Body-Text aus Bundle-Quellcode,
      // die Strategie ist deshalb entfernt.
      const html = `
        <html>
          <body>
            Check out this great recipe at https://example.com/lasagna
          </body>
        </html>
      `
      const $ = cheerio.load(html)
      expect(findOriginalUrl($)).toBeNull()
    })

    it('rejects the pinimg asset CDN — the live regression', () => {
      // Gemessen am 2026-08-07: beide Test-Pins lieferten diese URL, und
      // fetchWeb hat daraufhin ein JS-Bundle als Rezepttext geladen.
      const cdn = 'https://s.pinimg.com/webapp/www/_/_/accessibility-be939e6aa4c84056.mjs'
      const html = `<html><body><a href="${cdn}" rel="noopener">x</a></body></html>`
      const $ = cheerio.load(html)
      expect(findOriginalUrl($, html)).toBeNull()
    })

    it('rejects pinimg links found in embedded JSON', () => {
      const payload = JSON.stringify({ pin: { link: 'https://i.pinimg.com/736x/ab/cd.jpg' } })
      const html = `<html><body><script id="__PWS_DATA__" type="application/json">${payload}</script></body></html>`
      const $ = cheerio.load(html)
      expect(findOriginalUrl($, html)).toBeNull()
    })

    it('rejects asset URLs matched by the raw "link" regex', () => {
      const html = `<html><body><script>var x={"link":"https://cdn.example.com/bundle.js"}</script></body></html>`
      const $ = cheerio.load(html)
      expect(findOriginalUrl($, html)).toBeNull()
    })

    it('reads __PWS_DATA__ from the script-tag form Pinterest ships today', () => {
      const payload = JSON.stringify({ props: { pin: { link: 'https://chefkoch.de/rezepte/42/pasta.html' } } })
      const html = `<html><body><script id="__PWS_DATA__" type="application/json">${payload}</script></body></html>`
      const $ = cheerio.load(html)
      expect(findOriginalUrl($, html)).toBe('https://chefkoch.de/rezepte/42/pasta.html')
    })

    it('still reads the older __PWS_DATA__ assignment form', () => {
      const html = `<html><body><script>__PWS_DATA__ = {"link":"https://example.com/rezept"};</script></body></html>`
      const $ = cheerio.load(html)
      expect(findOriginalUrl($, html)).toBe('https://example.com/rezept')
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

  describe('isUsableExternalUrl', () => {
    it('accepts a normal recipe page', () => {
      expect(isUsableExternalUrl('https://www.chefkoch.de/rezepte/123/x.html')).toBe(true)
    })

    it('rejects every Pinterest and pinimg host', () => {
      for (const u of [
        'https://www.pinterest.com/pin/1',
        'https://pinterest.de/pin/1',
        'https://s.pinimg.com/webapp/x.mjs',
        'https://i.pinimg.com/736x/a.jpg',
      ]) {
        expect(isUsableExternalUrl(u), u).toBe(false)
      }
    })

    it('rejects asset paths on any host', () => {
      for (const u of [
        'https://cdn.example.com/app.mjs',
        'https://cdn.example.com/app.js',
        'https://cdn.example.com/style.css',
        'https://cdn.example.com/data.json',
      ]) {
        expect(isUsableExternalUrl(u), u).toBe(false)
      }
    })

    it('rejects non-http schemes and malformed input', () => {
      expect(isUsableExternalUrl('ftp://files.example.com/recipe')).toBe(false)
      expect(isUsableExternalUrl('/relative/path')).toBe(false)
      expect(isUsableExternalUrl('not a url')).toBe(false)
    })

    it('does not reject a host merely containing "pinterest"', () => {
      expect(isUsableExternalUrl('https://pinterest-recipes.example.com/r/1')).toBe(true)
    })
  })

  describe('fetchPinterest', () => {
    afterEach(() => { vi.unstubAllGlobals() })

    function stubHtml(html: string) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })))
    }

    it('throws instead of returning an empty bundle when the pin yields nothing', async () => {
      // Das ist die gemessene Realität: App-Shell ohne og:-Tags, ohne Pin-Daten.
      stubHtml('<html><head></head><body><div>app shell</div></body></html>')
      await expect(fetchPinterest('https://www.pinterest.com/pin/123/'))
        .rejects.toThrow(PINTEREST_NO_DATA_ERROR)
    })

    it('does not throw when og: metadata is present', async () => {
      stubHtml(`<html><head>
        <meta property="og:title" content="Pasta" />
        <meta property="og:description" content="Zutaten: Mehl, Eier" />
        <meta property="og:image" content="https://i.pinimg.com/736x/pasta.jpg" />
      </head><body></body></html>`)
      const bundle = await fetchPinterest('https://www.pinterest.com/pin/123/')
      expect(bundle.type).toBe('pinterest')
      expect(bundle.title).toBe('Pasta')
      expect(bundle.imageUrls).toContain('https://i.pinimg.com/736x/pasta.jpg')
    })

    it('hands off to fetchWeb when a usable outbound link exists', async () => {
      const { fetchWeb } = await import('../../src/fetchers/web.js')
      vi.mocked(fetchWeb).mockResolvedValue({
        url: 'https://chefkoch.de/rezepte/1/x.html',
        type: 'web',
        imageUrls: [],
        textContent: 'Zutaten: Mehl',
      } as any)
      stubHtml('<html><body><a href="https://chefkoch.de/rezepte/1/x.html" rel="noopener">r</a></body></html>')
      const bundle = await fetchPinterest('https://www.pinterest.com/pin/123/')
      expect(fetchWeb).toHaveBeenCalledWith('https://chefkoch.de/rezepte/1/x.html')
      expect(bundle.type).toBe('web')
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
