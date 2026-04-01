// PDF Export für Web — Browser-Print-Dialog (kein jsPDF nötig, kein SSR-Problem)
import type { Recipe } from '@/db/schema'

function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try { return JSON.parse(json) as T } catch { return fallback }
}

export async function shareRecipePDF(recipe: Recipe): Promise<void> {
  if (typeof window === 'undefined') return

  const ingredients = parseJSON<string[]>(recipe.ingredients, [])
  const steps = parseJSON<string[]>(recipe.steps, [])
  const tags = parseJSON<string[]>(recipe.tags, [])

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${recipe.name}</title>
<style>
  body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  .tags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .tag { background: #f3f0ff; color: #7c3aed; padding: 2px 10px; border-radius: 99px; font-size: 12px; }
  h2 { font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-top: 28px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; font-size: 14px; }
  ol { padding-left: 24px; }
  ol li { margin-bottom: 10px; font-size: 14px; }
  .source { font-size: 12px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>${recipe.emoji ?? '🍽️'} ${recipe.name}</h1>
<div class="meta">
  ${[recipe.servings ? `${recipe.servings} Portionen` : '', recipe.duration ?? '', recipe.calories ? `${recipe.calories} kcal` : ''].filter(Boolean).join(' · ')}
</div>
${tags.length > 0 ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
<h2>Zutaten</h2>
<ul>${ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
<h2>Zubereitung</h2>
<ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>
${recipe.notes ? `<h2>Notizen</h2><p>${recipe.notes}</p>` : ''}
${recipe.source_url ? `<div class="source">Quelle: ${recipe.source_url}</div>` : ''}
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}
