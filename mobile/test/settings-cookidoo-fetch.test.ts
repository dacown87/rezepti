import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// G4 — settings.tsx Cookidoo handlers use apiFetch (not raw fetch)
//
// The SettingsScreen component is a large React Native component — rendering
// it with RNTL would pull in many heavy dependencies. Instead we test the
// handler logic at the module level by extracting the async functions and
// verifying they call apiFetch with the correct arguments.
// ---------------------------------------------------------------------------

// Mock apiFetch before anything else imports it.
const apiFetchMock = vi.fn();
vi.mock('@/utils/api', () => ({
  apiFetch: apiFetchMock,
  // Provide other named exports that might be imported transitively
  ApiRequestError: class ApiRequestError extends Error {},
  readApiError: vi.fn(),
  assertApiOk: vi.fn(),
}));

// Mock heavy RN modules that settings.tsx imports
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock('@/utils/use-theme', () => ({
  useTheme: () => ({ isDark: false, setTheme: vi.fn() }),
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn().mockResolvedValue('https://api.test'),
  PRODUCTION_URL: 'https://production.test',
  SERVER_URL_KEY: 'server_url',
}));

vi.mock('@/utils/auth', () => ({
  getAuthSession: vi.fn(async () => null),
  getSupabaseClient: vi.fn(() => null),
  getAuthHeaders: vi.fn(async (h?: HeadersInit) => h),
}));

vi.mock('lucide-react-native', () => ({
  Eye: () => null,
  EyeOff: () => null,
  Key: () => null,
  Server: () => null,
  Info: () => null,
  Trash2: () => null,
  Save: () => null,
  ScrollText: () => null,
  Map: () => null,
  HelpCircle: () => null,
  X: () => null,
  ExternalLink: () => null,
  Sun: () => null,
  Moon: () => null,
  User: () => null,
}));

describe('cookidoo settings API helpers', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetchCookidooStatus uses GET /api/v1/cookidoo/status', async () => {
    const payload = { scope: 'user', connected: true, sharedByCurrentHousehold: true };
    apiFetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
    const { fetchCookidooStatus } = await import('@/utils/cookidoo-settings');

    await expect(fetchCookidooStatus()).resolves.toEqual(payload);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/cookidoo/status');
  });

  it('savePrivateCookidooCredentials uses POST /api/v1/cookidoo/credentials', async () => {
    apiFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const { savePrivateCookidooCredentials } = await import('@/utils/cookidoo-settings');

    await savePrivateCookidooCredentials('user@example.com', 'secret');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/cookidoo/credentials', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'secret' }),
    }));
  });

  it('deletePrivateCookidooCredentials uses DELETE /api/v1/cookidoo/credentials', async () => {
    apiFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const { deletePrivateCookidooCredentials } = await import('@/utils/cookidoo-settings');

    await deletePrivateCookidooCredentials();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/cookidoo/credentials', { method: 'DELETE' });
  });

  it('shareCookidooCredentials uses POST /api/v1/cookidoo/credentials/share', async () => {
    apiFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const { shareCookidooCredentials } = await import('@/utils/cookidoo-settings');

    await shareCookidooCredentials();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/cookidoo/credentials/share', { method: 'POST' });
  });

  it('deleteCookidooHouseholdShare uses DELETE /api/v1/cookidoo/credentials/share', async () => {
    apiFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const { deleteCookidooHouseholdShare } = await import('@/utils/cookidoo-settings');

    await deleteCookidooHouseholdShare();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v1/cookidoo/credentials/share', { method: 'DELETE' });
  });
});
