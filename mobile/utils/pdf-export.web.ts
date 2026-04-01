// PDF Export für Web — jsPDF mit dynamischen Imports (kein SSR-Problem)
import type { Recipe } from '@/db/schema'
import { encodeRecipeToCompactJSON } from './recipe-qr'

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) as T } catch { return fallback }
}

export async function shareRecipePDF(recipe: Recipe): Promise<void> {
  // Dynamische Imports — werden nur im Browser ausgeführt, nicht beim SSR
  const { jsPDF } = await import('jspdf')
  const QRCode = await import('qrcode')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Titel
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(`${recipe.emoji ?? ''} ${recipe.name}`.trim(), margin, y)
  y += 8

  // Meta
  const ingredients = parseJSON<string[]>(recipe.ingredients, [])
  const steps = parseJSON<string[]>(recipe.steps, [])
  const tags = parseJSON<string[]>(recipe.tags, [])

  const meta: string[] = []
  if (recipe.servings) meta.push(`${recipe.servings} Portionen`)
  if (recipe.duration) meta.push(recipe.duration)
  if (recipe.calories) meta.push(`${recipe.calories} kcal`)
  if (meta.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(meta.join(' · '), margin, y)
    y += 6
  }

  if (recipe.source_url) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(120)
    doc.text(`Quelle: ${recipe.source_url}`, margin, y)
    y += 8
  }

  if (tags.length > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(tags.join(' · '), margin, y)
    y += 8
  }

  y += 4

  // Zutaten
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text('Zutaten', margin, y)
  y += 7
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  for (const ing of ingredients) {
    const lines = doc.splitTextToSize(`• ${ing}`, contentWidth)
    for (const line of lines) {
      if (y > 270) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += 5
    }
  }
  y += 8

  // Schritte
  if (y > 230) { doc.addPage(); y = margin }
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Zubereitung', margin, y)
  y += 7
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  for (let i = 0; i < steps.length; i++) {
    const lines = doc.splitTextToSize(`${i + 1}. ${steps[i]}`, contentWidth)
    for (const line of lines) {
      if (y > 270) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += 5
    }
    y += 2
  }

  // Notizen
  if (recipe.notes) {
    y += 8
    if (y > 250) { doc.addPage(); y = margin }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Notizen', margin, y)
    y += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const noteLines = doc.splitTextToSize(recipe.notes, contentWidth)
    for (const line of noteLines) {
      if (y > 270) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += 4
    }
  }

  // QR Code
  y += 10
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y > pageHeight - 45) { doc.addPage(); y = margin }
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
  if (qrData) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 80, margin: 1 })
      doc.addImage(qrDataUrl, 'PNG', margin, y, 30, 30)
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text('QR-Code scannen → Rezept in App importieren', margin + 33, y + 15)
    } catch { /* ignore */ }
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `RecipeDeck | Seite ${i} von ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Download im Browser
  const filename = `${recipe.name.replace(/[^a-z0-9]/gi, '_')}.pdf`
  doc.save(filename)
}
