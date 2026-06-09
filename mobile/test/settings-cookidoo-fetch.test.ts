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

// ---------------------------------------------------------------------------
// TODO: Full component tests for the Cookidoo handlers in settings.tsx are
// deferred. The previous 4 tests in this file were tautological: they called
// apiFetchMock(...) directly and then asserted the mock was called — they
// never imported or invoked any code from settings.tsx and therefore provided
// zero real coverage.
//
// The real coverage gap: the three async handler functions in settings.tsx
// (loadCookidooStatus, handleSaveCookidoo, handleDisconnectCookidoo) are
// defined as inline closures inside the component body and are not exported,
// so they cannot be tested without rendering the component. A proper test
// requires RNTL + full server-mocking for the apiFetch layer, and is tracked
// as a follow-up item.
// ---------------------------------------------------------------------------
describe('settings.tsx — Cookidoo handlers (placeholder)', () => {
  // Tests deferred — see comment above.
});
