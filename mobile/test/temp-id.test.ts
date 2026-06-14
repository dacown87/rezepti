import { describe, expect, it } from 'vitest';
import { isTempId, newTempId } from '@/offline/temp-id';

describe('isTempId', () => {
  it('returns true for a string temp id', () => {
    expect(isTempId('tmp-abc123')).toBe(true);
  });

  it('returns true for any string', () => {
    expect(isTempId('anything')).toBe(true);
  });

  it('returns false for a numeric id', () => {
    expect(isTempId(5)).toBe(false);
  });

  it('returns false for 0', () => {
    expect(isTempId(0)).toBe(false);
  });
});

describe('newTempId', () => {
  it('starts with "tmp-"', () => {
    expect(newTempId()).toMatch(/^tmp-/);
  });

  it('generates unique ids', () => {
    const a = newTempId();
    const b = newTempId();
    expect(a).not.toBe(b);
  });

  it('includes a UUID after the prefix', () => {
    const id = newTempId();
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^tmp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
