import { describe, expect, it } from 'vitest';

import { buildAccountHref, mapProtectedApiError } from '@/utils/protected-access';
import { ApiRequestError } from '@/utils/api';

describe('protected access mapper', () => {
  it('builds a stable account href with return intent', () => {
    expect(buildAccountHref('/(tabs)/planner', 'signin')).toEqual({
      pathname: '/account',
      params: {
        mode: 'signin',
        returnTo: '/(tabs)/planner',
      },
    });
  });

  it('maps auth_missing to the account entry CTA', () => {
    const state = mapProtectedApiError(
      new ApiRequestError(401, 'Missing Authorization Bearer token', 'auth_missing'),
      '/(tabs)/shopping',
    );

    expect(state).toMatchObject({
      code: 'auth_missing',
      title: 'Anmeldung erforderlich',
      primaryLabel: 'Zu Account & Workspace',
      primaryHref: {
        pathname: '/account',
        params: { mode: 'signin', returnTo: '/(tabs)/shopping' },
      },
    });
  });

  it('maps bootstrap_failed to the workspace retry CTA', () => {
    const state = mapProtectedApiError(
      new ApiRequestError(500, 'Workspace is not ready.', 'bootstrap_failed'),
      '/(tabs)/planner',
    );

    expect(state).toMatchObject({
      code: 'bootstrap_failed',
      title: 'Workspace konnte nicht eingerichtet werden',
      primaryLabel: 'Workspace erneut einrichten',
    });
  });

  it('ignores non-auth errors', () => {
    expect(mapProtectedApiError(new Error('plain failure'), '/(tabs)')).toBeNull();
  });
});
