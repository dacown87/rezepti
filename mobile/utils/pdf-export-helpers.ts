export const PDF_QR_OPTIONS = {
  width: 400,
  margin: 1,
  errorCorrectionLevel: 'L' as const,
}

export function parsePDFJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

// jsPDF Helvetica cannot render emoji ranges reliably.
export function stripPdfUnsupportedCharacters(value: string): string {
  return value
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1FAFF}]/gu, '')
    .trim()
}

export function sanitizePdfFilename(name: string, fallback = 'RecipeDeck'): string {
  const cleaned = stripPdfUnsupportedCharacters(name)
    .replace(/[^a-z0-9äöüÄÖÜß]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return cleaned.length > 0 ? cleaned : fallback
}

export function recipePdfFilename(name: string): string {
  return `${sanitizePdfFilename(name)}.pdf`
}

export function buildRecipeQrUrl(serverUrl: string, recipeId: number | string): string {
  return `${serverUrl.replace(/\/+$/, '')}/recipe/${recipeId}`
}

export function escapePdfHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatRecipeSourceText(sourceUrl: string | null | undefined, createdAt?: number | null): string | null {
  if (!sourceUrl) return null

  const date = createdAt
    ? new Date(createdAt * 1000).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    : null

  return `Quelle: ${sourceUrl}${date ? `  (${date})` : ''}`
}
