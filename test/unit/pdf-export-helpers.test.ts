import { describe, expect, it } from 'vitest'
import {
  buildRecipeQrUrl,
  escapePdfHtml,
  formatRecipeSourceText,
  parsePDFJson,
  PDF_QR_OPTIONS,
  recipePdfFilename,
  sanitizePdfFilename,
  stripPdfUnsupportedCharacters,
} from '../../mobile/utils/pdf-export-helpers'

describe('PDF export helpers', () => {
  it('parses JSON values with a fallback for missing or invalid recipe fields', () => {
    expect(parsePDFJson<string[]>('["Mehl","Milch"]', [])).toEqual(['Mehl', 'Milch'])
    expect(parsePDFJson<string[] | null>(null, [])).toEqual([])
    expect(parsePDFJson<string[]>('not json', ['fallback'])).toEqual(['fallback'])
  })

  it('builds the shared QR navigation URL for web and native PDFs', () => {
    expect(buildRecipeQrUrl('https://recipes.example.test', 42)).toBe('https://recipes.example.test/recipe/42')
    expect(buildRecipeQrUrl('https://recipes.example.test/', 42)).toBe('https://recipes.example.test/recipe/42')
  })

  it('keeps the QR code generation options identical for web and native exporters', () => {
    expect(PDF_QR_OPTIONS).toEqual({
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'L',
    })
  })

  it('creates stable PDF filenames with umlauts and special characters', () => {
    expect(sanitizePdfFilename('🥘 Käse & Öl: süß/sauer?')).toBe('Käse_Öl_süß_sauer')
    expect(recipePdfFilename('Crème brûlée <Test>')).toBe('Cr_me_br_l_e_Test.pdf')
    expect(recipePdfFilename('🍽️')).toBe('RecipeDeck.pdf')
  })

  it('sanitizes unsupported emoji characters without dropping normal text', () => {
    expect(stripPdfUnsupportedCharacters('Tomaten 🍅 & Käse')).toBe('Tomaten  & Käse')
  })

  it('escapes HTML-sensitive characters used in native PDF templates', () => {
    expect(escapePdfHtml(`Käse & <Öl> "süß" 'sauer'`))
      .toBe('Käse &amp; &lt;Öl&gt; &quot;süß&quot; &#39;sauer&#39;')
  })

  it('omits the source block for recipes without source_url', () => {
    expect(formatRecipeSourceText(null)).toBeNull()
    expect(formatRecipeSourceText(undefined)).toBeNull()
  })

  it('formats source text with an optional German creation date', () => {
    expect(formatRecipeSourceText('https://example.test/rezept', 1_777_982_400))
      .toBe('Quelle: https://example.test/rezept  (05.05.2026)')
  })
})
