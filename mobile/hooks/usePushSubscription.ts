import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/utils/api';

// ---------------------------------------------------------------------------
// Dependency types — allow injection for unit tests
// ---------------------------------------------------------------------------

export interface SubscribeDeps {
  registration: ServiceWorkerRegistration;
  vapidKey: string;
  requestPermission: () => Promise<NotificationPermission>;
  postSubscription: (sub: unknown) => Promise<Response>;
}

export interface UnsubscribeDeps {
  registration: ServiceWorkerRegistration;
  deleteSubscription: (endpoint: string) => Promise<Response>;
}

// ---------------------------------------------------------------------------
// urlBase64ToUint8Array — VAPID key conversion helper
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// subscribeToPush — injectable, pure logic (testable without browser globals)
// ---------------------------------------------------------------------------

export async function subscribeToPush(deps: SubscribeDeps): Promise<boolean> {
  const permission = await deps.requestPermission();
  if (permission !== 'granted') return false;

  const existing = await deps.registration.pushManager.getSubscription();
  const sub =
    existing ??
    (await deps.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(deps.vapidKey) as unknown as ArrayBuffer,
    }));

  const json = (sub as PushSubscription).toJSON();
  const res = await deps.postSubscription({ endpoint: json.endpoint, keys: json.keys });
  return res.ok;
}

// ---------------------------------------------------------------------------
// unsubscribeFromPush — full lifecycle unsubscribe + server DELETE
// ---------------------------------------------------------------------------

export async function unsubscribeFromPush(deps: UnsubscribeDeps): Promise<boolean> {
  const sub = await deps.registration.pushManager.getSubscription();
  if (!sub) return true; // already unsubscribed

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  const res = await deps.deleteSubscription(endpoint);
  return res.ok;
}

// ---------------------------------------------------------------------------
// Production wiring — uses navigator/serviceWorker/Notification globals
// ---------------------------------------------------------------------------

export async function enablePushNotifications(vapidKey: string): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    typeof Notification === 'undefined'
  ) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;

  return subscribeToPush({
    registration,
    vapidKey,
    requestPermission: () => Notification.requestPermission(),
    postSubscription: (sub) =>
      apiFetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      }),
  });
}

export async function disablePushNotifications(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;

  return unsubscribeFromPush({
    registration,
    deleteSubscription: (endpoint) =>
      apiFetch('/api/v1/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }),
  });
}

// ---------------------------------------------------------------------------
// usePushSubscription hook
// ---------------------------------------------------------------------------

export interface PushSubscriptionState {
  supported: boolean;
  enabled: boolean;
  loading: boolean;
  denied: boolean;
  iosNeedsInstall: boolean;
  toggle: () => void;
}

function isSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof Notification !== 'undefined' &&
    typeof window !== 'undefined' &&
    'PushManager' in window
  );
}

function isDenied(): boolean {
  if (typeof Notification === 'undefined') return false;
  return Notification.permission === 'denied';
}

function detectIosNeedsInstall(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
  if (!isIos) return false;
  const isStandalone =
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches;
  return !isStandalone;
}

export function usePushSubscription(vapidKey: string): PushSubscriptionState {
  const [supported] = useState(() => isSupported());
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [denied] = useState(() => isDenied());
  const [iosNeedsInstall] = useState(() => detectIosNeedsInstall());

  // Check current subscription state on mount
  useEffect(() => {
    if (!supported) return;

    let cancelled = false;
    void navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (!cancelled) setEnabled(sub != null);
      }),
    );
    return () => { cancelled = true; };
  }, [supported]);

  const toggle = useCallback(() => {
    if (!supported || loading) return;

    setLoading(true);
    const action = enabled
      ? disablePushNotifications()
      : enablePushNotifications(vapidKey);

    void action.then((success) => {
      if (success) setEnabled((prev) => !prev);
    }).finally(() => {
      setLoading(false);
    });
  }, [enabled, loading, supported, vapidKey]);

  return { supported, enabled, loading, denied, iosNeedsInstall, toggle };
}
