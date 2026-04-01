// PDF Export für Web — jsPDF (gleiche Library wie im Web-Frontend)
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { Recipe } from '@/db/schema'
import { encodeRecipeToCompactJSON } from './recipe-qr'

function buildSummary(recipe: Recipe): string {
  const parts: string[] = []
  const tags = parseJSON<string[]>(recipe.tags, [])
  if (tags.length > 0) parts.push(tags.slice(0, 3).join(' · '))
  const meta: string[] = []
  if (recipe.servings) meta.push(`${recipe.servings} Portionen`)
  if (recipe.duration) meta.push(recipe.duration)
  if (meta.length > 0) parts.push(meta.join(' · '))
  return parts.join('  |  ')
}

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) as T } catch { return fallback }
}

export async function generateRecipePDF(recipe: Recipe): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Titel
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(recipe.name, margin, y)
  y += 8

  // Summary
  const summary = buildSummary(recipe)
  if (summary) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100)
    doc.text(summary, margin, y)
    y += 7
  }

  // Quelle
  if (recipe.source_url) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100)
    doc.text(`Quelle: ${recipe.source_url}`, margin, y)
    y += 8
  }

  // Meta
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0)
  const meta: string[] = []
  if (recipe.servings) meta.push(`Portionen: ${recipe.servings}`)
  if (recipe.duration) meta.push(`Dauer: ${recipe.duration}`)
  if (recipe.calories) meta.push(`Kalorien: ${recipe.calories}`)
  if (recipe.rating) meta.push(`Bewertung: ${'★'.repeat(recipe.rating)}${'☆'.repeat(5 - recipe.rating)}`)
  if (meta.length > 0) { doc.text(meta.join(' | '), margin, y); y += 8 }
  y += 5

  // Zutaten
  const ingredients = parseJSON<string[]>(recipe.ingredients, [])
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Zutaten', margin, y)
  y += 8
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
  y += 10

  // Schritte
  const steps = parseJSON<string[]>(recipe.steps, [])
  if (y > 230) { doc.addPage(); y = margin }
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Zubereitung', margin, y)
  y += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  for (let i = 0; i < steps.length; i++) {
    const lines = doc.splitTextToSize(`${i + 1}. ${steps[i]}`, contentWidth)
    for (const line of lines) {
      if (y > 270) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += 5
    }
    y += 3
  }

  // Notizen
  if (recipe.notes) {
    y += 10
    if (y > 250) { doc.addPage(); y = margin }
    doc.setFontSize(14)
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
  if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = margin }
  const qrData = encodeRecipeToCompactJSON({
    name: recipe.name,
    emoji: recipe.emoji ?? '',
    ingredients: parseJSON<string[]>(recipe.ingredients, []),
    steps: parseJSON<string[]>(recipe.steps, []),
    rating: recipe.rating ?? undefined,
    servings: recipe.servings ?? undefined,
    duration: recipe.duration ?? undefined,
    tags: parseJSON<string[]>(recipe.tags, []),
    source_url: recipe.source_url ?? undefined,
  })
  if (qrData) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 80, margin: 1 })
      doc.addImage(qrDataUrl, 'PNG', margin, y, 30, 30)
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text('QR-Code: Rezept scannen → in App importieren', margin, y + 32)
    } catch { /* ignore */ }
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Rezept von RecipeDeck | Seite ${i} von ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  return doc.output('blob')
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
