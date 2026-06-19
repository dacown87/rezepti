import { apiFetch, assertApiOk, readApiError } from './api';

export interface AuthMeResponse {
  userId: string;
  email: string | null;
  appRole: 'admin' | 'user';
  activeHouseholdId: string | null;
  memberships: Array<{ householdId: string; role: 'owner' | 'member' }>;
}

export interface ByokValidationPolicyResponse {
  windowMinutes: number;
  maxRequests: number;
  source: 'default' | 'database';
  status: 'uninitialized' | 'active';
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByUserId: string | null;
  appliesTo: string[];
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const response = await apiFetch('/api/v1/auth/me');
  await assertApiOk(response, `Auth-Profil konnte nicht geladen werden (${response.status})`);
  return response.json();
}

export async function fetchByokValidationPolicy(): Promise<ByokValidationPolicyResponse> {
  const response = await apiFetch('/api/v1/admin/byok-validation-policy');
  await assertApiOk(response, `BYOK-Policy konnte nicht geladen werden (${response.status})`);
  return response.json();
}

export async function saveByokValidationPolicy(input: {
  windowMinutes: number;
  maxRequests: number;
}): Promise<ByokValidationPolicyResponse> {
  const response = await apiFetch('/api/v1/admin/byok-validation-policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await readApiError(response, `BYOK-Policy konnte nicht gespeichert werden (${response.status})`);
  }

  return response.json();
}
