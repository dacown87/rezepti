// PDF Export für Web — jsPDF
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import type { Recipe } from '@/db/schema'
import { encodeRecipeToCompactJSON } from './recipe-qr'
import { getServerUrl } from '@/utils/server-url'

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) as T } catch { return fallback }
}

// jsPDF (Helvetica) kann keine Unicode-Emojis rendern → entfernen
function stripEmoji(str: string): string {
  return str.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1FAFF}]/gu, '').trim()
}

async function fetchImageAsBase64(url: string, serverUrl: string): Promise<string | null> {
  try {
    // Bild über Backend-Proxy laden, um CORS zu umgehen
    const proxyUrl = `${serverUrl}/api/v1/proxy/image?url=${encodeURIComponent(url)}`
    const res = await fetch(proxyUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}


export async function shareRecipePDF(recipe: Recipe): Promise<void> {
  const serverUrl = await getServerUrl()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ingredients = parseJSON<string[]>(recipe.ingredients, [])
  const steps = parseJSON<string[]>(recipe.steps, [])
  const tags = parseJSON<string[]>(recipe.tags, [])

  // Bild via Proxy (CORS-frei)
  if (recipe.image_url) {
    const dataUrl = await fetchImageAsBase64(recipe.image_url, serverUrl)
    if (dataUrl) {
      const imgHeight = 65
      doc.addImage(dataUrl, 'JPEG', margin, y, contentWidth, imgHeight)
      y += imgHeight + 6
    }
  }

  // Titel (ohne Emoji — jsPDF Helvetica kann keine Unicode-Emojis)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(stripEmoji(recipe.name), margin, y)
  y += 9

  // Meta
  const meta: string[] = []
  if (recipe.servings) meta.push(`${recipe.servings} Portionen`)
  if (recipe.duration) meta.push(recipe.duration)
  if (recipe.calories) meta.push(`${recipe.calories} kcal`)
  if (recipe.rating) meta.push(`Bewertung: ${recipe.rating}/5`)
  if (meta.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(meta.join(' · '), margin, y)
    y += 6
  }

  // Quelle + Datum
  if (recipe.source_url) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(120, 120, 120)
    const datum = recipe.created_at
      ? new Date(recipe.created_at * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null
    const urlText = `Quelle: ${recipe.source_url}${datum ? `  (${datum})` : ''}`
    const urlLines = doc.splitTextToSize(urlText, contentWidth)
    doc.text(urlLines, margin, y)
    y += urlLines.length * 4 + 2
  }

  // Tags
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
    const lines = doc.splitTextToSize(`- ${stripEmoji(ing)}`, contentWidth)
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
    const lines = doc.splitTextToSize(`${i + 1}. ${stripEmoji(steps[i])}`, contentWidth)
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
    const noteLines = doc.splitTextToSize(stripEmoji(recipe.notes), contentWidth)
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
      doc.text('QR-Code scannen -> Rezept in RecipeDeck importieren', margin + 31, y + 14)
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

  doc.save(`${stripEmoji(recipe.name).replace(/[^a-z0-9äöüÄÖÜ]/gi, '_').replace(/_+/g, '_')}.pdf`)
}

export async function shareRecipeCardsPDF(recipes: Recipe[]): Promise<void> {
  if (recipes.length === 0) return
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  const cardW = (pageWidth - margin * 3) / 2
  const cardH = (pageHeight - margin * 5) / 4
  const cardsPerPage = 8

  let idx = 0
  for (const recipe of recipes) {
    if (idx > 0 && idx % cardsPerPage === 0) doc.addPage()
    const row = Math.floor((idx % cardsPerPage) / 2)
    const col = (idx % cardsPerPage) % 2
    const x = margin + col * (cardW + margin)
    const y = margin + row * (cardH + margin)

    // Card background
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD')

    const tags = parseJSON<string[]>(recipe.tags, [])
    const pad = 3

    // Bild laden (wenn vorhanden)
    const imgAreaH = cardH * 0.5
    if (recipe.image_url) {
      try {
        const serverUrl = await getServerUrl()
        const dataUrl = await fetchImageAsBase64(recipe.image_url, serverUrl)
        if (dataUrl) doc.addImage(dataUrl, 'JPEG', x, y, cardW, imgAreaH)
      } catch { /* kein Bild */ }
    } else {
      // Emoji als Platzhalter
      doc.setFontSize(20)
      doc.text(recipe.emoji ?? '🍽', x + cardW / 2, y + imgAreaH / 2 + 4, { align: 'center' })
    }

    // Name
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    const nameLines = doc.splitTextToSize(stripEmoji(recipe.name), cardW - pad * 2)
    doc.text(nameLines.slice(0, 2), x + pad, y + imgAreaH + pad + 4)

    // Meta
    const meta: string[] = []
    if (recipe.servings) meta.push(`${recipe.servings} Port.`)
    if (recipe.duration) meta.push(recipe.duration)
    if (meta.length) {
      doc.setFontSize(6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(156, 163, 175)
      doc.text(meta.join(' · '), x + pad, y + imgAreaH + pad + 10)
    }

    // Tags
    if (tags.length > 0) {
      doc.setFontSize(6)
      doc.setTextColor(124, 58, 237)
      doc.text(tags.slice(0, 3).join(' · '), x + pad, y + cardH - pad - 3)
    }

    // Footer
    doc.setFontSize(5)
    doc.setTextColor(209, 213, 219)
    doc.text('RecipeDeck', x + cardW / 2, y + cardH - 1, { align: 'center' })

    // QR Code
    try {
      const qrData = encodeRecipeToCompactJSON({
        name: recipe.name, emoji: recipe.emoji ?? '',
        ingredients: parseJSON<string[]>(recipe.ingredients, []),
        steps: parseJSON<string[]>(recipe.steps, []),
        tags,
      })
      if (qrData) {
        const qrUrl = await QRCode.toDataURL(qrData, { width: 60, margin: 1 })
        const qrSize = 14
        doc.addImage(qrUrl, 'PNG', x + cardW - pad - qrSize, y + cardH - pad - qrSize, qrSize, qrSize)
      }
    } catch { /* ignore */ }

    idx++
  }

  // Footer alle Seiten
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text(`RecipeDeck — Seite ${i} von ${total}`, pageWidth / 2, pageHeight - 4, { align: 'center' })
  }

  doc.save(`RecipeDeck_Karten.pdf`)
}
