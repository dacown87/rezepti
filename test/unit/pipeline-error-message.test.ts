import { describe, it, expect } from 'vitest'
import { toUserFriendlyError } from '../../src/pipeline.js'

// Regression: import failures surfaced "[object Object]" in the UI because
// toUserFriendlyError did String(error) on a non-Error thrown value (e.g. a
// Groq/OpenAI SDK error object or a rejected plain object), which stringifies
// to "[object Object]". See pipeline.ts toUserFriendlyError.
describe('toUserFriendlyError', () => {
  it('never surfaces "[object Object]" for a non-Error object', () => {
    const result = toUserFriendlyError({ some: 'object' })
    expect(result.message).not.toContain('[object Object]')
  })

  it('uses a string .message on an error-like object and classifies it', () => {
    const result = toUserFriendlyError({ message: 'Request failed with status 429 rate limit' })
    expect(result.message).not.toContain('[object Object]')
    expect(result.message).toMatch(/API-Limit|Limit/i)
  })

  it('extracts a nested SDK-style error message (error.message)', () => {
    const result = toUserFriendlyError({ error: { message: 'invalid api key provided' } })
    expect(result.message).not.toContain('[object Object]')
    expect(result.message).toMatch(/API-Key/i)
  })

  it('extracts a deeply nested response.data.error.message', () => {
    const result = toUserFriendlyError({ response: { data: { error: { message: 'HTTP 404 not found' } } } })
    expect(result.message).not.toContain('[object Object]')
    expect(result.message).toMatch(/nicht gefunden|404/i)
  })

  it('preserves Error.message classification', () => {
    const result = toUserFriendlyError(new Error('fetch failed: ECONNREFUSED'))
    expect(result.message).toMatch(/Verbindungsfehler/i)
  })

  it('falls back to a clean German message for an opaque object', () => {
    const result = toUserFriendlyError({ a: 1, b: 2, c: 3 })
    expect(result.message).not.toContain('[object Object]')
    expect(result.message.length).toBeGreaterThan(10)
  })

  it('handles null and undefined without crashing or "[object Object]"', () => {
    expect(toUserFriendlyError(null).message).not.toContain('[object Object]')
    expect(toUserFriendlyError(undefined).message).not.toContain('[object Object]')
  })
})
