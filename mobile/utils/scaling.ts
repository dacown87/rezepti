const LEADING_NUMBER_RE = /^(\d+(?:[.,]\d+)?)/

export function parseServingsNumber(servings: string | null): number {
  if (!servings) return 4;
  const match = servings.match(/\d+/);
  if (!match) return 4;
  return parseInt(match[0], 10);
}

export function scaleIngredient(ingredient: string, factor: number): string {
  return ingredient.replace(LEADING_NUMBER_RE, (match) => {
    const num = parseFloat(match.replace(',', '.')) * factor;
    const rounded = Math.round(num * 10) / 10;
    return String(rounded);
  });
}

export function parseIngredientNumber(ingredient: string): number | null {
  const match = ingredient.match(LEADING_NUMBER_RE);
  if (!match) return null;
  return parseFloat(match[1].replace(',', '.'));
}
