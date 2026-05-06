import { describe, expect, it } from 'vitest'
import { formatRecipeSourceText } from '../../mobile/utils/pdf-export-helpers'

describe('native PDF export source formatting behavior', () => {
  it('includes created_at date in de-DE format when source_url exists', () => {
    const text = formatRecipeSourceText('https://example.test/rezept', 1_777_982_400)

    expect(text).toBe('Quelle: https://example.test/rezept  (05.05.2026)')
  })

  it('returns null when no source_url is present', () => {
    expect(formatRecipeSourceText(null, 1_777_982_400)).toBeNull()
  })
})
