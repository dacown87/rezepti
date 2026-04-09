import { vi } from 'vitest'

// Mock fetch globally for backend tests
global.fetch = vi.fn()
