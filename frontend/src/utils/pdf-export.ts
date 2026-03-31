import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { Recipe } from '../api/types.js'
import { encodeRecipeToCompactJSON } from './recipe-qr.js'

async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const proxyUrl = `/api/v1/proxy/image?url=${encodeURIComponent(imageUrl)}`
    const res = await fetch(proxyUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function buildSummary(recipe: Recipe): string {
  const parts: string[] = []
  if (recipe.tags?.length > 0) parts.push(recipe.tags.slice(0, 3).join(' · '))
  const meta: string[] = []
  if (recipe.servings) meta.push(`${recipe.servings} Portionen`)
  if (recipe.duration) meta.push(recipe.duration)
  if (meta.length > 0) parts.push(meta.join(' · '))
  return parts.join('  |  ')
}

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

  // Hero image
  if (recipe.imageUrl) {
    const dataUrl = await fetchImageAsDataUrl(recipe.imageUrl)
    if (dataUrl) {
      doc.addImage(dataUrl, 'JPEG', margin, y, contentWidth, 65)
      y += 70
    }
  }

  // Title (smaller, below image — no emoji, helvetica can't render it)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(recipe.name, margin, y)
  y += 8

  // Summary line (tags · servings · duration — no AI)
  const summary = buildSummary(recipe)
  if (summary) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100)
    doc.text(summary, margin, y)
    y += 7
  }

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
  doc.setFont('helvetica', 'normal')
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

  // QR Code — needs ~45mm; add new page if not enough room
  y += 10
  if (y > doc.internal.pageSize.getHeight() - 45) {
    doc.addPage()
    y = margin
  }
  
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
  const cardWidth = (pageWidth - margin * 3) / 2 // 2 columns: left + gap + right margin
  const cardHeight = (pageHeight - margin * 5) / 4 // 4 rows: top + 3 gaps + bottom margin
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

    // Fixed bottom zone: QR (18mm) + 2mm padding = 20mm from card bottom
    const pad = 2
    const qrSize = 18
    const qrTopY = y + cardHeight - pad - qrSize   // top edge of QR code
    const titleBaseline = qrTopY - 3               // title sits 3mm above QR
    const tagsBaseline = qrTopY + qrSize / 2 + 1   // vertically centred in QR area
    const qrX = x + cardWidth - pad - qrSize

    // Image: fills from top to just above title (aspect-ratio-preserving)
    const imgMaxW = cardWidth - pad * 2
    const imgMaxH = titleBaseline - (y + pad) - 4  // 4mm gap between image and title
    if (recipe.imageUrl) {
      const dataUrl = await fetchImageAsDataUrl(recipe.imageUrl)
      if (dataUrl) {
        const img = new Image()
        img.src = dataUrl
        await new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve() })
        const scale = Math.min(imgMaxW / (img.naturalWidth || imgMaxW), imgMaxH / (img.naturalHeight || imgMaxH))
        const drawW = (img.naturalWidth || imgMaxW) * scale
        const drawH = (img.naturalHeight || imgMaxH) * scale
        doc.addImage(dataUrl, 'JPEG', x + pad + (imgMaxW - drawW) / 2, y + pad, drawW, drawH)
      }
    }

    // Title: one line directly above QR
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    const titleMaxChars = Math.floor((qrX - x - 5) / 2.2) // approximate chars fitting left of QR
    const truncatedTitle = recipe.name.length > titleMaxChars ? recipe.name.substring(0, titleMaxChars - 3) + '...' : recipe.name
    doc.text(truncatedTitle, x + pad + 2, titleBaseline)

    // Tags: bottom-left, vertically centred with QR
    const tags = recipe.tags?.join(' · ') || ''
    if (tags) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 120, 120)
      const tagMaxW = qrX - x - pad - 4
      const tagLines = doc.splitTextToSize(tags, tagMaxW)
      doc.text(tagLines[0], x + pad + 2, tagsBaseline)
    }

    // QR Code: bottom-right
    try {
      const qrData = encodeRecipeToCompactJSON(recipe)
      if (qrData) {
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 60, margin: 1 })
        doc.addImage(qrDataUrl, 'PNG', qrX, qrTopY, qrSize, qrSize)
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
