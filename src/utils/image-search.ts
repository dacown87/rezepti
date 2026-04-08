interface ChefkochResult {
  id: string;
  title: string;
  previewImageUrl?: string;
}

async function searchChefkoch(query: string, limit: number): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  const res = await fetch(
    `https://api.chefkoch.de/v2/recipes?query=${encoded}&limit=${limit}&sortBy=relevance`,
    {
      headers: {
        'User-Agent': 'RecipeDeck/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as ChefkochResult[] ?? [])
    .map(r => r.previewImageUrl)
    .filter((url): url is string => !!url);
}

export async function searchRecipeImages(recipeName: string): Promise<string[]> {
  try {
    const results = await searchChefkoch(recipeName, 6);
    return results.slice(0, 4);
  } catch {
    return [];
  }
}
