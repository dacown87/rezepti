export async function searchRecipeImages(recipeName: string, limit = 4): Promise<string[]> {
  const url = `https://api.chefkoch.de/v2/recipes?query=${encodeURIComponent(recipeName)}&limit=${limit + 2}&sortBy=relevance`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? [])
      .map((r: any) => r.recipe?.previewImageUrlTemplate?.replace('<format>', 'crop-960x720'))
      .filter(Boolean)
      .slice(0, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
