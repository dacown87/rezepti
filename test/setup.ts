import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Automatically cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock global objects
if (typeof window !== 'undefined') {
  // Mock localStorage
  const localStorageMock = {
    store: {} as Record<string, string>,
    getItem(key: string) {
      return this.store[key] || null
    },
    setItem(key: string, value: string) {
      this.store[key] = value.toString()
    },
    removeItem(key: string) {
      delete this.store[key]
    },
    clear() {
      this.store = {}
    },
    length: 0,
    key(index: number) {
      return Object.keys(this.store)[index] || null
    },
  }
  
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })
  
  // Mock fetch
  global.fetch = vi.fn()
}