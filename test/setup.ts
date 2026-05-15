import { vi } from 'vitest'

// Unit tests use mocked fetch by default.
// E2E suites opt out via VITEST_E2E_REAL_FETCH=1 to hit the real API.
if (process.env.VITEST_E2E_REAL_FETCH !== '1') {
  global.fetch = vi.fn() as any
}
