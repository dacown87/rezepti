/**
 * Shared API fetch helpers used by React Query hooks.
 * All functions resolve the server URL and return typed data.
 */
import type { Session } from '@supabase/supabase-js';
import { getServerUrl } from './server-url';
import { getAuthSession, refreshAuthSession } from './auth';
import {
  RECIPE_USER_HASH_HEADER,
  isCacheableRecipeRequest,
  strongHash,
  userCacheName,
} from '../sw/cache-names';

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
  // Sharing / favorites read-model (Phase 3 — optional so older cached payloads don't break)
  scope?: 'private' | 'household';
  isFavorite?: boolean;
  canShareToHousehold?: boolean;
  canCopyToPrivate?: boolean;
}

/**
 * A recipe collection (system favorites or user-created custom collection).
 */
export interface Collection {
  id: string;
  kind: 'favorites' | 'custom';
  name: string;
  owner_type: 'user' | 'household';
  item_count: number;
  is_system: boolean;
}

export interface RecipeShareInvitePreview {
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  recipeName: string;
  senderEmail: string | null;
  recipientEmail: string;
  expiresAt: string;
  acceptedRecipeId: number | null;
}

export interface CreatedRecipeShareInvite {
  token: string;
  expiresAt: string;
  preview: RecipeShareInvitePreview;
}

export interface AddRecipeToCollectionResult {
  added: boolean;
  recipeId: number;
  copied: boolean;
}

export interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    cause?: string;
    fix?: string;
    docs?: string;
  };
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly causeText?: string,
    public readonly fix?: string,
    public readonly docs?: string,
  ) {
    super(code ? `${message} (${code})` : message);
  }
}

let cachedRecipeRequestUserHash: { userId: string; hash: string } | null = null;

function isRecipeReadRequest(path: string, init?: RequestInit): boolean {
  const method = init?.method?.toUpperCase() ?? 'GET';
  return isCacheableRecipeRequest(new URL(path, 'https://rd.local'), method);
}

async function getCachedRecipeRequestUserHash(session: Session | null): Promise<string | null> {
  const userId = session?.user?.id?.trim();
  if (!userId) {
    cachedRecipeRequestUserHash = null;
    return null;
  }

  if (cachedRecipeRequestUserHash?.userId === userId) {
    return cachedRecipeRequestUserHash.hash;
  }

  const hash = await strongHash(userId);
  cachedRecipeRequestUserHash = { userId, hash };
  return hash;
}

/**
 * Removes stale PWA recipe reads before React Query refetches after a mutation.
 * Workbox uses stale-while-revalidate, so query invalidation alone can otherwise
 * consume the old cached response and remain stale until another refetch.
 */
export async function invalidateCachedRecipeReads(recipeId?: number): Promise<void> {
  if (typeof caches === 'undefined') return;

  try {
    const userHash = await getCachedRecipeRequestUserHash(await getAuthSession());
    if (!userHash) return;

    const cache = await caches.open(userCacheName(userHash));
    const requests = await cache.keys();
    const detailPath = recipeId === undefined ? null : `/api/v1/recipes/${recipeId}`;
    const staleRequests = requests.filter((request) => {
      const pathname = new URL(request.url).pathname;
      return pathname === '/api/v1/recipes' || pathname === detailPath;
    });

    await Promise.all(staleRequests.map((request) => cache.delete(request)));
  } catch {
    // Cache cleanup is best-effort; the network mutation already succeeded.
  }
}

async function buildRequestInit(path: string, init?: RequestInit): Promise<RequestInit | undefined> {
  const session = await getAuthSession();
  const headers = new Headers(init?.headers);
  let hasHeaders = Array.from(headers.keys()).length > 0;

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
    hasHeaders = true;
  }

  if (isRecipeReadRequest(path, init)) {
    const userHash = await getCachedRecipeRequestUserHash(session);
    if (userHash) {
      headers.set(RECIPE_USER_HASH_HEADER, userHash);
      hasHeaders = true;
    } else {
      headers.delete(RECIPE_USER_HASH_HEADER);
    }
  }

  return hasHeaders ? { ...init, headers } : init;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const serverUrl = await getServerUrl();
  const url = `${serverUrl}${path}`;
  const res = await fetch(url, await buildRequestInit(path, init));
  if (res.status !== 401) return res;

  // 401 → the access token has likely expired (e.g. the installed PWA was
  // backgrounded during a long extraction, suspending Supabase's auto-refresh
  // timer). Force one token refresh and retry exactly once before surfacing the
  // 401. Safe for POST/PATCH/DELETE: a 401 is rejected before the server
  // processes the request, so the original call had no side effect. If the
  // refresh fails (refresh token also dead) the original 401 is returned so the
  // caller can show the re-login prompt.
  const refreshed = await refreshAuthSession();
  if (!refreshed) return res;
  return fetch(url, await buildRequestInit(path, init));
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
        error.docs,
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

// ── Sharing ──────────────────────────────────────────────────────────────────

/**
 * Share (copy) a recipe to the caller's household or private space.
 * Returns the newly created recipe copy.
 */
export async function shareRecipe(
  id: number,
  target: 'household' | 'user',
): Promise<ApiRecipe> {
  const res = await apiFetch(`/api/v1/recipes/${id}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: { type: target } }),
  });
  await assertApiOk(res, `Teilen fehlgeschlagen (${res.status})`);
  const data = await res.json() as { recipe: ApiRecipe };
  await invalidateCachedRecipeReads();
  return data.recipe;
}

export async function createRecipeShareInvite(
  id: number,
  email: string,
): Promise<CreatedRecipeShareInvite> {
  const res = await apiFetch(`/api/v1/recipes/${id}/share-invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  await assertApiOk(res, `Einladung erstellen fehlgeschlagen (${res.status})`);
  const data = await res.json() as { invite: CreatedRecipeShareInvite };
  return data.invite;
}

export async function fetchRecipeShareInvite(token: string): Promise<RecipeShareInvitePreview> {
  const res = await apiFetch(`/api/v1/share-invites/${encodeURIComponent(token)}`);
  await assertApiOk(res, `Einladung laden fehlgeschlagen (${res.status})`);
  const data = await res.json() as { invite: RecipeShareInvitePreview };
  return data.invite;
}

export async function acceptRecipeShareInvite(token: string): Promise<{
  status: 'accepted';
  recipe: ApiRecipe;
  alreadyAccepted: boolean;
}> {
  const res = await apiFetch(`/api/v1/share-invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
  });
  await assertApiOk(res, `Einladung annehmen fehlgeschlagen (${res.status})`);
  const data = await res.json() as {
    status: 'accepted';
    recipe: ApiRecipe;
    alreadyAccepted: boolean;
  };
  await invalidateCachedRecipeReads();
  return data;
}

// ── Favorites ─────────────────────────────────────────────────────────────────

/**
 * Toggle a recipe's favorite state on or off.
 * Returns the resulting isFavorite boolean.
 */
export async function setRecipeFavorite(id: number, on: boolean): Promise<boolean> {
  const res = await apiFetch(`/api/v1/recipes/${id}/favorite`, {
    method: on ? 'POST' : 'DELETE',
  });
  await assertApiOk(res, `Favorit ${on ? 'setzen' : 'entfernen'} fehlgeschlagen (${res.status})`);
  const data = await res.json() as { success: boolean; isFavorite: boolean };
  await invalidateCachedRecipeReads(id);
  return data.isFavorite;
}

// ── Collections ───────────────────────────────────────────────────────────────

/**
 * Fetch all collections visible to the authenticated user.
 */
export async function fetchCollections(): Promise<Collection[]> {
  const res = await apiFetch('/api/v1/recipe-collections');
  await assertApiOk(res, `Sammlungen laden fehlgeschlagen (${res.status})`);
  const data = await res.json() as { collections: Collection[] };
  return data.collections;
}

/**
 * Create a new custom collection.
 */
export async function createCollection(input: {
  name: string;
  ownerType?: 'user' | 'household';
  householdId?: string;
}): Promise<Collection> {
  const res = await apiFetch('/api/v1/recipe-collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  await assertApiOk(res, `Sammlung erstellen fehlgeschlagen (${res.status})`);
  const data = await res.json() as { collection: Collection };
  return data.collection;
}

/**
 * Rename a custom collection (favorites cannot be renamed — server returns 400).
 */
export async function renameCollection(id: string, name: string): Promise<void> {
  const res = await apiFetch(`/api/v1/recipe-collections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  await assertApiOk(res, `Sammlung umbenennen fehlgeschlagen (${res.status})`);
}

/**
 * Delete a custom collection (favorites cannot be deleted — server returns 400).
 */
export async function deleteCollection(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/recipe-collections/${id}`, { method: 'DELETE' });
  await assertApiOk(res, `Sammlung löschen fehlgeschlagen (${res.status})`);
}

/**
 * Fetch the recipes contained in a collection. Each recipe carries the same
 * read-model fields (scope / isFavorite / share flags) as the recipe list.
 */
export async function fetchCollectionItems(collectionId: string): Promise<ApiRecipe[]> {
  const res = await apiFetch(`/api/v1/recipe-collections/${collectionId}/items`);
  await assertApiOk(res, `Rezepte der Sammlung laden fehlgeschlagen (${res.status})`);
  const data = await res.json() as { recipes: ApiRecipe[] };
  return data.recipes ?? [];
}

/**
 * Add a recipe to a collection. Returns { added: true } when newly inserted,
 * { added: false } when already present (idempotent).
 */
export async function addRecipeToCollection(
  collectionId: string,
  recipeId: number,
): Promise<AddRecipeToCollectionResult> {
  const res = await apiFetch(`/api/v1/recipe-collections/${collectionId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeId }),
  });
  await assertApiOk(res, `Rezept zur Sammlung hinzufügen fehlgeschlagen (${res.status})`);
  const data = await res.json() as {
    success: boolean;
    added: boolean;
    recipeId?: number;
    copied?: boolean;
  };
  if (data.copied) await invalidateCachedRecipeReads();
  return { added: data.added, recipeId: data.recipeId ?? recipeId, copied: data.copied === true };
}

/**
 * Remove a recipe from a collection.
 */
export async function removeRecipeFromCollection(
  collectionId: string,
  recipeId: number,
): Promise<void> {
  const res = await apiFetch(
    `/api/v1/recipe-collections/${collectionId}/items/${recipeId}`,
    { method: 'DELETE' },
  );
  await assertApiOk(res, `Rezept aus Sammlung entfernen fehlgeschlagen (${res.status})`);
}
