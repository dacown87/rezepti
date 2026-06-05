/**
 * Shared API fetch helpers used by React Query hooks.
 * All functions resolve the server URL and return typed data.
 */
import { getServerUrl } from './server-url';
import { getAuthHeaders } from './auth';

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

export interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    cause?: string;
    fix?: string;
  };
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly causeText?: string,
    public readonly fix?: string,
  ) {
    super(code ? `${message} (${code})` : message);
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const serverUrl = await getServerUrl();
  const headers = await getAuthHeaders(init?.headers);
  const nextInit = headers === undefined ? init : { ...init, headers };
  return fetch(`${serverUrl}${path}`, nextInit);
}

export async function readApiError(response: Response, fallbackMessage: string): Promise<ApiRequestError> {
  try {
    const body = await response.clone().json() as ApiErrorEnvelope;
    const error = body?.error;
    if (error?.message || error?.code) {
      return new ApiRequestError(
        response.status,
        error.message ?? fallbackMessage,
        error.code,
        error.cause,
        error.fix,
      );
    }
  } catch {
    // Fall back to the route-specific message when the response is not JSON.
  }

  return new ApiRequestError(response.status, fallbackMessage);
}

export async function assertApiOk(response: Response, fallbackMessage: string): Promise<void> {
  if (!response.ok) throw await readApiError(response, fallbackMessage);
}

export async function fetchRecipes(): Promise<ApiRecipe[]> {
  const res = await apiFetch('/api/v1/recipes');
  await assertApiOk(res, `Server-Fehler ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.recipes ?? []);
}

export async function fetchRecipeById(id: number): Promise<ApiRecipe> {
  const res = await apiFetch(`/api/v1/recipes/${id}`);
  await assertApiOk(res, `Rezept nicht gefunden (${res.status})`);
  return res.json();
}

export async function patchRecipe(id: number, fields: Record<string, unknown>): Promise<void> {
  const res = await apiFetch(`/api/v1/recipes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  await assertApiOk(res, `PATCH fehlgeschlagen (${res.status})`);
}

export async function deleteRecipe(id: number): Promise<void> {
  const res = await apiFetch(`/api/v1/recipes/${id}`, { method: 'DELETE' });
  await assertApiOk(res, `DELETE fehlgeschlagen (${res.status})`);
}
