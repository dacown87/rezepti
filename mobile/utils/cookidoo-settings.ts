import { apiFetch } from '@/utils/api';

export type CookidooStatusResponse = {
  scope: 'user' | 'household' | 'none';
  connected: boolean;
  sharedByCurrentHousehold: boolean;
  canManageHouseholdShare: boolean;
};

async function readJsonError(response: Response) {
  const payload = await response.json().catch(() => ({}));
  const error = typeof payload?.error === 'string' ? payload.error : `HTTP ${response.status}`;
  throw new Error(error);
}

export async function fetchCookidooStatus(): Promise<CookidooStatusResponse> {
  const res = await apiFetch('/api/v1/cookidoo/status');
  if (!res.ok) {
    await readJsonError(res);
  }
  return res.json();
}

export async function savePrivateCookidooCredentials(email: string, password: string): Promise<void> {
  const res = await apiFetch('/api/v1/cookidoo/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    await readJsonError(res);
  }
}

export async function deletePrivateCookidooCredentials(): Promise<void> {
  const res = await apiFetch('/api/v1/cookidoo/credentials', { method: 'DELETE' });
  if (!res.ok) {
    await readJsonError(res);
  }
}

export async function shareCookidooCredentials(): Promise<void> {
  const res = await apiFetch('/api/v1/cookidoo/credentials/share', { method: 'POST' });
  if (!res.ok) {
    await readJsonError(res);
  }
}

export async function deleteCookidooHouseholdShare(): Promise<void> {
  const res = await apiFetch('/api/v1/cookidoo/credentials/share', { method: 'DELETE' });
  if (!res.ok) {
    await readJsonError(res);
  }
}
