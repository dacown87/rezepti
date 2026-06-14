import webpush from 'web-push';

export interface PushPayload { title: string; body: string; url: string; }
interface PushSubRow { id: number; endpoint: string; keys: string; }

export interface SendPushDeps {
  loadSubscriptions: (userId: string) => Promise<PushSubRow[]>;
  sendNotification: (sub: webpush.PushSubscription, payload: string) => Promise<unknown>;
  deleteSubscription: (id: number) => Promise<void>;
}

let configured = false;
let warnedNoVapid = false; // X2: warn once when keys are missing
export function configureVapid(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@rezepti.app';
  if (!pub || !priv) {
    if (!warnedNoVapid) {
      warnedNoVapid = true;
      console.warn('[push] VAPID keys not set — notifications disabled (configureVapid=false)');
    }
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

const defaultDeps = (): SendPushDeps => ({
  loadSubscriptions: (userId) => import('./db-react.js').then((m) => m.getPushSubscriptionsForUser(userId)),
  sendNotification: (sub, payload) => webpush.sendNotification(sub, payload),
  deleteSubscription: (id) => import('./db-react.js').then((m) => m.deletePushSubscriptionById(id)),
});

/** Best-effort fan-out of a push payload to all of a user's subscriptions. */
export async function sendPushToUser(userId: string, payload: PushPayload, deps: SendPushDeps = defaultDeps()): Promise<void> {
  const subs = await deps.loadSubscriptions(userId);
  const body = JSON.stringify(payload);
  for (const row of subs) {
    const keys = JSON.parse(row.keys) as { p256dh: string; auth: string };
    try {
      await deps.sendNotification({ endpoint: row.endpoint, keys }, body);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      console.warn('[push] send failed', { endpoint: row.endpoint, status }); // X2: status visible
      if (status === 404 || status === 410) await deps.deleteSubscription(row.id);
      // Other errors swallowed — push is best-effort.
    }
  }
}
