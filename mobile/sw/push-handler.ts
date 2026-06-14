export interface BuiltNotification {
  title: string;
  options: { body: string; data: { url: string }; icon?: string; badge?: string };
}

export function buildNotification(raw: string): BuiltNotification {
  try {
    const p = JSON.parse(raw) as { title?: string; body?: string; url?: string };
    return {
      title: p.title ?? 'RecipeDeck',
      options: {
        body: p.body ?? '',
        data: { url: p.url ?? '/' },
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      },
    };
  } catch {
    return {
      title: 'RecipeDeck',
      options: { body: '', data: { url: '/' }, icon: '/icon-192.png' },
    };
  }
}

export function resolveClickUrl(data: { url?: string } | undefined): string {
  return data?.url ?? '/';
}
