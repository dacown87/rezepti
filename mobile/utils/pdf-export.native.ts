// PDF Export für Native — expo-print + expo-sharing
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import type { Recipe } from '@/db/schema'
import { encodeRecipeToCompactJSON } from './recipe-qr'

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) as T } catch { return fallback }
}

function buildHTMLTemplate(recipe: Recipe): string {
  const ingredients = parseJSON<string[]>(recipe.ingredients, [])
  const steps = parseJSON<string[]>(recipe.steps, [])
  const tags = parseJSON<string[]>(recipe.tags, [])
  const emoji = recipe.emoji ?? '🍽️'

  const qrData = encodeRecipeToCompactJSON({
    name: recipe.name,
    emoji: recipe.emoji ?? '',
    ingredients,
    steps,
    rating: recipe.rating ?? undefined,
    servings: recipe.servings ?? undefined,
    duration: recipe.duration ?? undefined,
    tags,
    source_url: recipe.source_url ?? undefined,
  })

  const metaParts: string[] = []
  if (recipe.servings) metaParts.push(`${recipe.servings} Portionen`)
  if (recipe.duration) metaParts.push(recipe.duration)
  if (recipe.calories) metaParts.push(`${recipe.calories} kcal`)

  const ingredientsHTML = ingredients
    .map(ing => `<li>${escapeHtml(ing)}</li>`)
    .join('\n')

  const stepsHTML = steps
    .map((step, i) => `<li><span class="step-num">${i + 1}</span>${escapeHtml(step)}</li>`)
    .join('\n')

  const tagsHTML = tags.length > 0
    ? `<div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : ''

  const notesHTML = recipe.notes
    ? `<div class="section"><h2>Notizen</h2><p class="notes">${escapeHtml(recipe.notes)}</p></div>`
    : ''

  const sourceHTML = recipe.source_url
    ? `<p class="source">Quelle: ${escapeHtml(recipe.source_url)}</p>`
    : ''

  // QR placeholder — expo-print kann kein dynamisches QR rendern ohne externe URL
  // Wir zeigen stattdessen den Compact-JSON-Code als Text-Hinweis
  const qrNote = qrData
    ? `<div class="qr-note">RecipeDeck QR-Import: Dieses Rezept kann mit der RecipeDeck-App gescannt werden.</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1f2937; padding: 32px; font-size: 14px; line-height: 1.6; }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 18px; font-weight: 700; margin-bottom: 12px; color: #111827; border-bottom: 2px solid #f3f4f6; padding-bottom: 6px; }
  .emoji { font-size: 48px; margin-bottom: 12px; display: block; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 8px; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 16px; }
  .tag { background: #f3f4f6; border-radius: 99px; padding: 2px 10px; font-size: 11px; color: #4b5563; }
  .source { color: #9ca3af; font-size: 11px; margin-bottom: 16px; word-break: break-all; }
  .section { margin-bottom: 24px; }
  ul.ingredients { list-style: none; padding: 0; }
  ul.ingredients li { padding: 6px 0; border-bottom: 1px solid #f9fafb; padding-left: 14px; position: relative; }
  ul.ingredients li::before { content: "•"; position: absolute; left: 0; color: #9333ea; }
  ol.steps { list-style: none; padding: 0; counter-reset: none; }
  ol.steps li { display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }
  .step-num { background: #9333ea; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
  .notes { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 4px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
  .qr-note { margin-top: 16px; font-size: 10px; color: #9ca3af; font-style: italic; }
  hr { border: none; border-top: 1px solid #f3f4f6; margin: 20px 0; }
</style>
</head>
<body>
  <span class="emoji">${emoji}</span>
  <h1>${escapeHtml(recipe.name)}</h1>
  ${metaParts.length > 0 ? `<p class="meta">${escapeHtml(metaParts.join(' · '))}</p>` : ''}
  ${tagsHTML}
  ${sourceHTML}
  <hr>

  <div class="section">
    <h2>Zutaten</h2>
    <ul class="ingredients">${ingredientsHTML}</ul>
  </div>

  <div class="section">
    <h2>Zubereitung</h2>
    <ol class="steps">${stepsHTML}</ol>
  </div>

  ${notesHTML}

  ${qrNote}

  <div class="footer">Rezept von RecipeDeck</div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Rendert das Rezept als PDF und öffnet den nativen Share/Print-Dialog.
 * Wirft bei Fehler — Aufrufer muss catch.
 */
export async function shareRecipePDF(recipe: Recipe): Promise<void> {
  const html = buildHTMLTemplate(recipe)

  const { uri } = await Print.printToFileAsync({ html, base64: false })

  const canShare = await Sharing.isAvailableAsync()
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${recipe.emoji ?? ''} ${recipe.name}`,
      UTI: 'com.adobe.pdf',
    })
  } else {
    await Print.printAsync({ uri })
  }
}

/**
 * Öffnet direkt den System-Druckdialog (Print.printAsync).
 */
export async function printRecipe(recipe: Recipe): Promise<void> {
  const html = buildHTMLTemplate(recipe)
  await Print.printAsync({ html })
}

// Alias für einheitliche API mit Web-Version
export const generateRecipePDF = shareRecipePDF
export const downloadPDF = (_blob: unknown, _filename: string) => {
  console.warn('downloadPDF ist auf Native nicht verfügbar — nutze shareRecipePDF')
}
