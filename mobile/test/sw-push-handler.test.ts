import { describe, it, expect } from 'vitest';
import { buildNotification, resolveClickUrl } from '@/sw/push-handler';

describe('buildNotification', () => {
  it('parses valid JSON with title, body and url', () => {
    const raw = JSON.stringify({ title: 'Rezept fertig', body: 'Dein Import ist abgeschlossen', url: '/recipe/42' });
    const n = buildNotification(raw);

    expect(n.title).toBe('Rezept fertig');
    expect(n.options.body).toBe('Dein Import ist abgeschlossen');
    expect(n.options.data.url).toBe('/recipe/42');
    expect(n.options.icon).toBe('/icon-192.png');
  });

  it('falls back to RecipeDeck title and root url for malformed JSON', () => {
    const n = buildNotification('not json');

    expect(n.title).toBe('RecipeDeck');
    expect(n.options.data.url).toBe('/');
    expect(n.options.icon).toBe('/icon-192.png');
  });

  it('uses RecipeDeck as title when title field is missing in payload', () => {
    const raw = JSON.stringify({ body: 'Hallo', url: '/recipe/9' });
    const n = buildNotification(raw);

    expect(n.title).toBe('RecipeDeck');
    expect(n.options.body).toBe('Hallo');
    expect(n.options.data.url).toBe('/recipe/9');
  });
});

describe('resolveClickUrl', () => {
  it('returns the url from data when present', () => {
    expect(resolveClickUrl({ url: '/recipe/9' })).toBe('/recipe/9');
  });

  it('returns / when data is undefined', () => {
    expect(resolveClickUrl(undefined)).toBe('/');
  });
});
