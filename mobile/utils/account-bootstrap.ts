import { apiFetch, assertApiOk } from './api';

export interface AccountBootstrapResponse {
  status: 'ready';
  result: 'created' | 'existing';
  profile: {
    ready: true;
    userId: string;
    email: string | null;
    appRole: 'admin' | 'user';
  };
  workspace: {
    ready: true;
    id: string;
    name: string;
    isDefault: boolean;
  };
  membership: {
    ready: true;
    householdId: string;
    role: 'owner' | 'member';
  };
  warnings: string[];
}

export async function bootstrapAccount(): Promise<AccountBootstrapResponse> {
  const response = await apiFetch('/api/v1/auth/bootstrap', {
    method: 'POST',
  });
  await assertApiOk(response, `Bootstrap fehlgeschlagen (${response.status})`);
  return response.json();
}
