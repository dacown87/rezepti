export interface CategoryKeywordRule {
  category: string;
  keywords: string[];
}

export const CATEGORY_KEYWORDS: CategoryKeywordRule[] = [
  { category: 'Auflauf',         keywords: ['auflauf', 'gratin', 'lasagne', 'überbacken'] },
  { category: 'Nudelgericht',    keywords: ['pasta', 'nudeln', 'spaghetti', 'penne', 'tagliatelle'] },
  { category: 'Fleischgericht',  keywords: ['fleisch', 'steak', 'schnitzel', 'hackfleisch', 'braten', 'gulasch'] },
  { category: 'Geflügel',        keywords: ['hähnchen', 'hühnchen', 'pute', 'geflügel'] },
  { category: 'Fischgericht',    keywords: ['fisch', 'lachs', 'thunfisch', 'shrimps', 'garnele', 'meeresfrüchte'] },
  { category: 'Suppe',           keywords: ['suppe', 'eintopf', 'brühe', 'cremesuppe', 'minestrone'] },
  { category: 'Salat',           keywords: ['salat'] },
  { category: 'Gebäck & Kuchen', keywords: ['kuchen', 'gebäck', 'muffin', 'torte', 'backen', 'kekse', 'brot'] },
  { category: 'Frühstück',       keywords: ['frühstück', 'pancake', 'pfannkuchen', 'porridge', 'müsli', 'granola'] },
  { category: 'Snack',           keywords: ['snack', 'vorspeise', 'fingerfood', 'dip', 'toast'] },
  { category: 'Vegetarisch',     keywords: ['vegetarisch', 'vegan'] },
  { category: 'Asiatisch',       keywords: ['asiatisch', 'wok', 'curry', 'sushi', 'ramen', 'thai', 'dim sum'] },
];

export function detectCategory(tags: string[], name: string): string | null {
  const text = [...tags, name].join(' ').toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => text.includes(kw))) {
      return category;
    }
  }
  return null;
}

export function recipeMatchesCategory(
  recipe: { category?: string | null; name: string; tags?: string[] },
  selectedCategory: string
): boolean {
  if (recipe.category) {
    return recipe.category === selectedCategory;
  }

  const detected = detectCategory(recipe.tags ?? [], recipe.name);
  return detected === selectedCategory;
}

const LEADING_NUMBER_RE = /^(\d+(?:[.,]\d+)?)/
const UNIT_RE = /\b(g|kg|ml|l|el|tl|tsp|tbsp|prise|stk|stück|pack|päckchen|dose|n)\b/i;

function splitIngredient(ingredient: string): { quantity: string; rest: string } | null {
  const match = ingredient.match(new RegExp(LEADING_NUMBER_RE.source + '(.*)'));
  if (!match) {
    return null;
  }
  return { quantity: match[1], rest: match[2] };
}

export function extractIngredientNameForMatching(fullIngredient: string): string {
  const split = splitIngredient(fullIngredient);
  if (!split) {
    return fullIngredient.trim();
  }

  const rest = split.rest.trim();
  const unitMatch = rest.match(UNIT_RE);
  if (unitMatch) {
    const unitEnd = unitMatch.index! + unitMatch[0].length;
    const afterUnit = rest.slice(unitEnd).trim();
    if (afterUnit) {
      return afterUnit;
    }
  }

  return rest || fullIngredient.trim();
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function isIngredientNameSimilar(a: string, b: string, maxDistance?: number): boolean {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return false;
  }

  const threshold = maxDistance ?? Math.max(1, Math.floor(0.3 * maxLen));
  const distance = levenshtein(a.toLowerCase(), b.toLowerCase());
  return distance <= threshold;
}

export function normalizeIngredientSearchTerms(terms: string[]): string[] {
  return terms
    .map((term) => term.toLowerCase().trim())
    .filter(Boolean);
}

export function ingredientMatchesTerm(ingredient: string, searchTerm: string): boolean {
  const term = searchTerm.toLowerCase().trim();
  if (!term) {
    return false;
  }

  const ingredientLower = ingredient.toLowerCase();
  const ingredientName = extractIngredientNameForMatching(ingredient).toLowerCase();

  return ingredientLower.includes(term) ||
    isIngredientNameSimilar(ingredientName, term) ||
    ingredientName.includes(term) ||
    term.includes(ingredientName);
}

export interface IngredientSearchEvaluation {
  matchScore: number;
  matchedIngredients: string[];
  missingIngredients: string[];
}

export function evaluateIngredientSearch(
  recipeIngredients: string[],
  searchTerms: string[]
): IngredientSearchEvaluation {
  const normalizedTerms = normalizeIngredientSearchTerms(searchTerms);
  if (normalizedTerms.length === 0) {
    return {
      matchScore: 0,
      matchedIngredients: [],
      missingIngredients: [],
    };
  }

  const matchedIngredients: string[] = [];
  const missingIngredients: string[] = [...normalizedTerms];

  for (const ingredient of recipeIngredients) {
    for (const term of normalizedTerms) {
      if (matchedIngredients.includes(term)) {
        continue;
      }
      if (ingredientMatchesTerm(ingredient, term)) {
        matchedIngredients.push(term);
        const missingIndex = missingIngredients.indexOf(term);
        if (missingIndex !== -1) {
          missingIngredients.splice(missingIndex, 1);
        }
      }
    }
  }

  return {
    matchScore: Math.round((matchedIngredients.length / normalizedTerms.length) * 100),
    matchedIngredients,
    missingIngredients,
  };
}
