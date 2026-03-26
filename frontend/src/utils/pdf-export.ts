import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { Recipe } from '../api/types.js'

export async function generateRecipePDF(recipe: Recipe): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Title with emoji
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  const title = `${recipe.emoji || ''} ${recipe.name}`.trim()
  doc.text(title, margin, y)
  y += 12

  // Source URL
  if (recipe.source_url) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100)
    doc.text(`Quelle: ${recipe.source_url}`, margin, y)
    y += 8
  }

  // Metadata
  doc.setFontSize(11)
  doc.setTextColor(0)
  const meta: string[] = []
  if (recipe.servings) meta.push(`Portionen: ${recipe.servings}`)
  if (recipe.duration) meta.push(`Dauer: ${recipe.duration}`)
  if (recipe.calories) meta.push(`Kalorien: ${recipe.calories}`)
  if (recipe.rating) meta.push(`Bewertung: ${'★'.repeat(recipe.rating)}${'☆'.repeat(5 - recipe.rating)}`)
  
  if (meta.length > 0) {
    doc.text(meta.join(' | '), margin, y)
    y += 8
  }

  // Tags
  if (recipe.tags && recipe.tags.length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Tags: ${recipe.tags.join(', ')}`, margin, y)
    y += 8
  }

  y += 5

  // Ingredients section
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Zutaten', margin, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  
  for (const ingredient of recipe.ingredients) {
    const lines = doc.splitTextToSize(`• ${ingredient}`, contentWidth)
    for (const line of lines) {
      if (y > 270) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y)
      y += 5
    }
  }

  y += 10

  // Steps section
  if (y > 230) {
    doc.addPage()
    y = margin
  }
  
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Zubereitung', margin, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  for (let i = 0; i < recipe.steps.length; i++) {
    const stepText = `${i + 1}. ${recipe.steps[i]}`
    const lines = doc.splitTextToSize(stepText, contentWidth)
    
    for (const line of lines) {
      if (y > 270) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y)
      y += 5
    }
    y += 3
  }

  // Notes
  if (recipe.notes) {
    y += 10
    if (y > 250) {
      doc.addPage()
      y = margin
    }
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Notizen', margin, y)
    y += 6
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const noteLines = doc.splitTextToSize(recipe.notes, contentWidth)
    for (const line of noteLines) {
      doc.text(line, margin, y)
      y += 4
    }
  }

  // QR Code on last page
  if (recipe.source_url) {
    y = doc.internal.pageSize.getHeight() - 40
    
    try {
      const qrDataUrl = await QRCode.toDataURL(recipe.source_url, {
        width: 80,
        margin: 1,
      })
      doc.addImage(qrDataUrl, 'PNG', margin, y, 30, 30)
      
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text('QR-Code zur Original-Rezeptseite', margin, y + 32)
    } catch (err) {
      console.error('QR generation failed:', err)
    }
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