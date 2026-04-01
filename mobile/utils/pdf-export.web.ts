// PDF Export für Web — jsPDF
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { Recipe } from '@/db/schema'
import { encodeRecipeToCompactJSON } from './recipe-qr'

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) as T } catch { return fallback }
}

export async function shareRecipePDF(recipe: Recipe): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ingredients = parseJSON<string[]>(recipe.ingredients, [])
  const steps = parseJSON<string[]>(recipe.steps, [])
  const tags = parseJSON<string[]>(recipe.tags, [])

  // Bild (wenn vorhanden, als base64 laden)
  const imageUrl = recipe.image_url ?? null
  if (imageUrl) {
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const imgHeight = 60
      doc.addImage(dataUrl, 'JPEG', margin, y, contentWidth, imgHeight)
      y += imgHeight + 6
    } catch { /* Bild nicht verfügbar */ }
  }

  // Titel
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(`${recipe.emoji ?? ''} ${recipe.name}`.trim(), margin, y)
  y += 9

  // Meta
  const meta: string[] = []
  if (recipe.servings) meta.push(`${recipe.servings} Portionen`)
  if (recipe.duration) meta.push(recipe.duration)
  if (recipe.calories) meta.push(`${recipe.calories} kcal`)
  if (meta.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(meta.join(' · '), margin, y)
    y += 6
  }

  if (recipe.source_url) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(120, 120, 120)
    const urlText = `Quelle: ${recipe.source_url}`
    const urlLines = doc.splitTextToSize(urlText, contentWidth)
    doc.text(urlLines, margin, y)
    y += urlLines.length * 4 + 2
  }

  if (tags.length > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 80, 180)
    doc.text(tags.join(' · '), margin, y)
    y += 7
  }

  // Trennlinie
  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 7

  // Zutaten
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Zutaten', margin, y)
  y += 7
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  for (const ing of ingredients) {
    const lines = doc.splitTextToSize(`• ${ing}`, contentWidth)
    for (const line of lines) {
      if (y > pageHeight - 25) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += 5
    }
  }
  y += 6

  // Zubereitung
  if (y > pageHeight - 40) { doc.addPage(); y = margin }
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Zubereitung', margin, y)
  y += 7
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  for (let i = 0; i < steps.length; i++) {
    const lines = doc.splitTextToSize(`${i + 1}. ${steps[i]}`, contentWidth)
    for (const line of lines) {
      if (y > pageHeight - 25) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += 5
    }
    y += 2
  }

  // Notizen
  if (recipe.notes) {
    y += 6
    if (y > pageHeight - 30) { doc.addPage(); y = margin }
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Notizen', margin, y)
    y += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const noteLines = doc.splitTextToSize(recipe.notes, contentWidth)
    for (const line of noteLines) {
      if (y > pageHeight - 25) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += 4
    }
  }

  // QR Code
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
      y += 8
      if (y > pageHeight - 45) { doc.addPage(); y = margin }
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 80, margin: 1 })
      doc.addImage(qrDataUrl, 'PNG', margin, y, 28, 28)
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text('QR-Code scannen → Rezept in RecipeDeck importieren', margin + 31, y + 14)
    } catch { /* ignore */ }
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`RecipeDeck | Seite ${i} von ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
  }

  doc.save(`${recipe.name.replace(/[^a-z0-9äöüÄÖÜ]/gi, '_')}.pdf`)
}
