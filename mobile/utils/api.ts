/**
 * Shared API fetch helpers used by React Query hooks.
 * All functions resolve the server URL and return typed data.
 */
import { getServerUrl } from './server-url';

export interface ApiRecipe {
  id: number;
  name: string;
  emoji?: string;
  source_url?: string;
  image_url?: string;
  ingredients: string;
  steps: string;
  tags?: string | string[];
  category?: string;
  servings?: string;
  duration?: string;
  calories?: number;
  rating?: number;
  notes?: string;
  tried?: number;
  pdf_created?: number;
  equipment?: string | null;
  nutrition_info?: string | null;
  created_at?: string | null;
}

export async function fetchRecipes(): Promise<ApiRecipe[]> {
  const serverUrl = await getServerUrl();
  const res = await fetch(`${serverUrl}/api/v1/recipes`);
  if (!res.ok) throw new Error(`Server-Fehler ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.recipes ?? []);
}

export async function fetchRecipeById(id: number): Promise<ApiRecipe> {
  const serverUrl = await getServerUrl();
  const res = await fetch(`${serverUrl}/api/v1/recipes/${id}`);
  if (!res.ok) throw new Error(`Rezept nicht gefunden (${res.status})`);
  return res.json();
}

export async function patchRecipe(id: number, fields: Record<string, unknown>): Promise<void> {
  const serverUrl = await getServerUrl();
  const res = await fetch(`${serverUrl}/api/v1/recipes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`PATCH fehlgeschlagen (${res.status})`);
}

export async function deleteRecipe(id: number): Promise<void> {
  const serverUrl = await getServerUrl();
  const res = await fetch(`${serverUrl}/api/v1/recipes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE fehlgeschlagen (${res.status})`);
}
