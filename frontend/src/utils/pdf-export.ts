import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { Recipe } from '../api/types.js'
import { encodeRecipeToCompactJSON } from './recipe-qr.js'

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
      if (y > 270) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y)
      y += 4
    }
  }

  // QR Code on last page
  y = doc.internal.pageSize.getHeight() - 50
  
  // Try to generate offline recipe QR (compact JSON, max 2KB)
  const offlineQR = encodeRecipeToCompactJSON(recipe)
  
  if (offlineQR) {
    try {
      const qrDataUrl = await QRCode.toDataURL(offlineQR, {
        width: 80,
        margin: 1,
      })
      doc.addImage(qrDataUrl, 'PNG', margin, y, 30, 30)
      
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text('QR-Code: Rezept scannen → in App importieren', margin, y + 32)
    } catch (err) {
      console.error('Offline QR generation failed:', err)
    }
  } else {
    // Recipe too large for offline QR, show URL QR instead
    if (recipe.source_url) {
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
export async function generateRecipeCardsPDF(recipes: Recipe[]): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  const cardWidth = (pageWidth - margin * 3) / 2 // 2 columns
  const cardHeight = (pageHeight - margin * 3) / 4 // 4 rows
  const cardsPerPage = 8

  let cardIndex = 0

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i]

    // New page if needed
    if (cardIndex > 0 && cardIndex % cardsPerPage === 0) {
      doc.addPage()
    }

    // Calculate position
    const row = Math.floor((cardIndex % cardsPerPage) / 2)
    const col = (cardIndex % cardsPerPage) % 2
    const x = margin + col * (cardWidth + margin)
    const y = margin + row * (cardHeight + margin)

    // Card background
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(230, 230, 230)
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD')

    // Emoji + Name
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    const title = `${recipe.emoji || ''} ${recipe.name}`.trim()
    const truncatedTitle = title.length > 25 ? title.substring(0, 22) + '...' : title
    doc.text(truncatedTitle, x + 5, y + 10)

    // Info (ingredients, duration)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    const info = `${recipe.ingredients?.length || 0} Zutaten${recipe.duration ? ' • ' + recipe.duration : ''}`
    doc.text(info, x + 5, y + 18)

    // Rating
    if (recipe.rating) {
      doc.setFontSize(10)
      doc.setTextColor(218, 165, 32) // Gold
      doc.text('★'.repeat(recipe.rating), x + 5, y + 26)
    }

    // QR Code
    try {
      const qrData = encodeRecipeToCompactJSON(recipe)
      if (qrData) {
        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 60,
          margin: 1,
        })
        doc.addImage(qrDataUrl, 'PNG', x + cardWidth - 25, y + cardHeight - 25, 20, 20)
      }
    } catch (err) {
      console.error('QR generation failed for card:', err)
    }

    cardIndex++
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Rezeptkarten von RecipeDeck | Seite ${i} von ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    )
  }

  return doc.output('blob')
}
