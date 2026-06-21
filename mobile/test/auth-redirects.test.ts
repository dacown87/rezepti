import { describe, expect, it } from 'vitest';

import { buildAuthRedirectUrl, readAuthRedirectOptions } from '@/utils/auth';

describe('auth redirect helpers', () => {
  it('builds account redirect urls with mode and return intent', () => {
    expect(buildAuthRedirectUrl('/account', {
      mode: 'signup',
      returnTo: '/(tabs)/planner',
    })).toBe('recipedeck://account?mode=signup&returnTo=%2F%28tabs%29%2Fplanner');
  });

  it('reads redirect options from auth callback urls', () => {
    expect(
      readAuthRedirectOptions('recipedeck://account?mode=update-password&returnTo=%2F%28tabs%29%2Fshopping'),
    ).toEqual({
      mode: 'update-password',
      returnTo: '/(tabs)/shopping',
    });
  });

  it('falls back to the default app route for unsafe external return intents', () => {
    expect(buildAuthRedirectUrl('/account', {
      mode: 'signin',
      returnTo: 'https://evil.example.test/phish',
    })).toBe('recipedeck://account?mode=signin&returnTo=%2F%28tabs%29');
  });
});
