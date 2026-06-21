import { describe, expect, it } from 'vitest';

import {
  buildLoginFirstAccountHref,
  DEFAULT_AUTHENTICATED_PATH,
  isPublicLoginFirstPath,
  isSafeInternalReturnTo,
  normalizeReturnTo,
} from '@/utils/login-first-routing';

describe('login-first routing helpers', () => {
  it('accepts only app-internal return intents', () => {
    expect(isSafeInternalReturnTo('/recipe/42')).toBe(true);
    expect(isSafeInternalReturnTo('/(tabs)/planner')).toBe(true);
    expect(isSafeInternalReturnTo('https://evil.example.test')).toBe(false);
    expect(isSafeInternalReturnTo('//evil.example.test')).toBe(false);
  });

  it('normalizes missing, root, and unsafe return intents to the authenticated default', () => {
    expect(normalizeReturnTo(undefined)).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(normalizeReturnTo('/')).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(normalizeReturnTo('https://evil.example.test')).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it('recognizes public login-first paths', () => {
    expect(isPublicLoginFirstPath('/account')).toBe(true);
    expect(isPublicLoginFirstPath('/+not-found')).toBe(true);
    expect(isPublicLoginFirstPath('/recipe/42')).toBe(false);
  });

  it('builds guarded account hrefs with a normalized return target', () => {
    expect(buildLoginFirstAccountHref('https://evil.example.test')).toEqual({
      pathname: '/account',
      params: {
        mode: 'signin',
        returnTo: '/(tabs)',
      },
    });
  });
});
