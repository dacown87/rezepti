// PDF Export für Native — expo-print + expo-sharing / SAF Downloads
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { StorageAccessFramework, EncodingType, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform, Alert } from 'react-native'
import type { Recipe } from '@/db/schema'
import { getServerUrl } from '@/utils/server-url'

const DOWNLOADS_URI_KEY = 'pdf_downloads_dir_uri'

/**
 * Auf Android: speichert das PDF direkt in den Downloads-Ordner via SAF.
 * Beim ersten Aufruf öffnet sich ein Ordner-Picker — der User wählt "Downloads".
 * Die Erlaubnis wird in AsyncStorage gespeichert (einmalig).
 * Auf iOS: nicht verfügbar (kein SAF).
 */
async function saveToDownloadsAndroid(sourceUri: string, filename: string): Promise<void> {
  let dirUri = await AsyncStorage.getItem(DOWNLOADS_URI_KEY)

  if (!dirUri) {
    const result = await StorageAccessFramework.requestDirectoryPermissionsAsync()
    if (!result.granted) {
      throw new Error('Ordner-Zugriff verweigert')
    }
    dirUri = result.directoryUri
    await AsyncStorage.setItem(DOWNLOADS_URI_KEY, dirUri)
  }

  const base64 = await readAsStringAsync(sourceUri, { encoding: EncodingType.Base64 })

  try {
    const destUri = await StorageAccessFramework.createFileAsync(dirUri, filename, 'application/pdf')
    await writeAsStringAsync(destUri, base64, { encoding: EncodingType.Base64 })
  } catch {
    // Gespeicherte Erlaubnis ungültig (z.B. nach Neustart) — zurücksetzen und erneut versuchen
    await AsyncStorage.removeItem(DOWNLOADS_URI_KEY)
    const result = await StorageAccessFramework.requestDirectoryPermissionsAsync()
    if (!result.granted) throw new Error('Ordner-Zugriff verweigert')
    await AsyncStorage.setItem(DOWNLOADS_URI_KEY, result.directoryUri)
    const destUri = await StorageAccessFramework.createFileAsync(result.directoryUri, filename, 'application/pdf')
    await writeAsStringAsync(destUri, base64, { encoding: EncodingType.Base64 })
  }
}

async function deliverPDF(uri: string, filename: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'android') {
    await saveToDownloadsAndroid(uri, filename)
    Alert.alert('Gespeichert', `„${filename}" wurde im gewählten Ordner gespeichert.`)
  } else {
    const canShare = await Sharing.isAvailableAsync()
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle,
        UTI: 'com.adobe.pdf',
      })
    } else {
      await Print.printAsync({ uri })
    }
  }
}

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) as T } catch { return fallback }
}

async function buildHTMLTemplate(recipe: Recipe, serverUrl: string): Promise<string> {
  const ingredients = parseJSON<string[]>(recipe.ingredients, [])
  const steps = parseJSON<string[]>(recipe.steps, [])
  const tags = parseJSON<string[]>(recipe.tags, [])
  const emoji = recipe.emoji ?? '🍽️'

  // QR-Code enkodiert direkte Navigations-URL
  let qrImgTag = ''
  if (recipe.id) {
    try {
      const QRCode = await import('qrcode')
      const qrValue = `${serverUrl}/recipe/${recipe.id}`
      const dataUrl = await QRCode.toDataURL(qrValue, { width: 400, margin: 1, errorCorrectionLevel: 'L' })
      qrImgTag = `<div class="qr-block"><img src="${dataUrl}" class="qr-img" /><p class="qr-label">In RecipeDeck öffnen</p></div>`
    } catch { /* ignore */ }
  }

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
  .qr-block { margin-top: 24px; display: flex; align-items: center; gap: 12px; }
  .qr-img { width: 60px; height: 60px; flex-shrink: 0; }
  .qr-label { font-size: 10px; color: #9ca3af; }
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

  ${qrImgTag}

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
  const serverUrl = await getServerUrl()
  const html = await buildHTMLTemplate(recipe, serverUrl)

  const { uri } = await Print.printToFileAsync({ html, base64: false })
  const filename = `${recipe.name.replace(/[^a-z0-9äöüÄÖÜ]/gi, '_').replace(/_+/g, '_')}.pdf`
  await deliverPDF(uri, filename, `${recipe.emoji ?? ''} ${recipe.name}`)
}

/**
 * Öffnet direkt den System-Druckdialog (Print.printAsync).
 */
export async function printRecipe(recipe: Recipe): Promise<void> {
  const serverUrl = await getServerUrl()
  const html = await buildHTMLTemplate(recipe, serverUrl)
  await Print.printAsync({ html })
}

// Alias für einheitliche API mit Web-Version
export const generateRecipePDF = shareRecipePDF
export const downloadPDF = (_blob: unknown, _filename: string) => {
  console.warn('downloadPDF ist auf Native nicht verfügbar — nutze shareRecipePDF')
}

/**
 * Erstellt ein PDF mit mehreren Rezeptkarten (2×4 Grid pro Seite) und teilt es.
 * Layout identisch zur Web-Version: Bild oben (50%), Name/Meta/Tags darunter, QR unten rechts.
 */
export async function shareRecipeCardsPDF(recipes: Recipe[]): Promise<void> {
  if (recipes.length === 0) return

  const serverUrl = await getServerUrl()

  // QR-Codes vorab generieren — enkodieren direkte Navigations-URL
  const QRCode = await import('qrcode')
  const qrMap = new Map<number, string>()
  for (const recipe of recipes) {
    if (recipe.id == null) continue
    try {
      const qrValue = `${serverUrl}/recipe/${recipe.id}`
      const dataUrl = await QRCode.toDataURL(qrValue, { width: 400, margin: 1, errorCorrectionLevel: 'L' })
      qrMap.set(recipe.id, dataUrl)
    } catch { /* ignore */ }
  }

  const cardsPerPage = 8
  const pages: Recipe[][] = []
  for (let i = 0; i < recipes.length; i += cardsPerPage) {
    pages.push(recipes.slice(i, i + cardsPerPage))
  }

  function buildCard(recipe: Recipe): string {
    const tags = parseJSON<string[]>(recipe.tags, [])
    const tagStr = tags.slice(0, 3).join(' · ')
    const emoji = recipe.emoji ?? '🍽️'
    const meta: string[] = []
    if (recipe.servings) meta.push(recipe.servings + ' Port.')
    if (recipe.duration) meta.push(recipe.duration)

    // Bild: echte URL (expo-print lädt direkt) oder Emoji-Platzhalter
    const imgAreaHTML = recipe.image_url
      ? `<img src="${escapeHtml(recipe.image_url)}" class="card-real-img" />`
      : `<div class="card-emoji">${escapeHtml(emoji)}</div>`

    const qrUrl = recipe.id != null ? qrMap.get(recipe.id) : undefined
    const qrHTML = qrUrl ? `<img src="${qrUrl}" class="card-qr" />` : ''

    return `
      <div class="card">
        <div class="card-img-area">${imgAreaHTML}</div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(recipe.name)}</div>
          ${meta.length ? `<div class="card-meta">${escapeHtml(meta.join(' · '))}</div>` : ''}
          <div class="card-bottom">
            <div class="card-tags">${escapeHtml(tagStr)}</div>
            ${qrHTML}
          </div>
        </div>
        <div class="card-footer">RecipeDeck</div>
      </div>`
  }

  const pagesHTML = pages.map(page => `
    <div class="page">
      <div class="grid">
        ${page.map(buildCard).join('')}
      </div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; background: #f9fafb; }
  .page { width: 210mm; min-height: 297mm; padding: 10mm; page-break-after: always; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, 1fr); gap: 6mm; height: 277mm; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; }
  /* Bild-Bereich: obere 50% der Karte */
  .card-img-area { height: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f9fafb; }
  .card-real-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .card-emoji { font-size: 28px; line-height: 1; }
  /* Unterer Bereich */
  .card-body { flex: 1; padding: 4px 8px; display: flex; flex-direction: column; position: relative; }
  .card-title { font-size: 9px; font-weight: 700; color: #111827; line-height: 1.3; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .card-meta { font-size: 6px; color: #9ca3af; margin-bottom: 2px; }
  /* Tags links, QR rechts — beide am unteren Rand */
  .card-bottom { display: flex; align-items: flex-end; justify-content: space-between; flex: 1; }
  .card-tags { font-size: 6px; color: #7c3aed; }
  .card-qr { width: 18mm; height: 18mm; flex-shrink: 0; }
  .card-footer { font-size: 5px; color: #d1d5db; text-align: center; padding: 2px; border-top: 1px solid #f3f4f6; }
  @media print { .page { page-break-after: always; } }
</style>
</head>
<body>${pagesHTML}</body>
</html>`

  const { uri } = await Print.printToFileAsync({ html, base64: false })
  await deliverPDF(uri, 'RecipeDeck_Karten.pdf', `RecipeDeck — ${recipes.length} Rezeptkarten`)
}
