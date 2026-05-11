import { getVapidPublicKey } from '../api/reports.ts';
import { registerPushSubscription, unregisterPushSubscription } from '../api/subscriptions.ts';

const ENDPOINT_HASH_KEY = 'fieldfix-push-hash';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

export interface PushState {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}

export async function getPushState(): Promise<PushState> {
  if (!('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, permission: 'denied', subscribed: false };
  }
  const permission = Notification.permission;
  if (permission !== 'granted') {
    return { supported: true, permission, subscribed: false };
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return { supported: true, permission, subscribed: sub !== null };
}

export async function subscribeToPush(): Promise<string | null> {
  if (!('PushManager' in window) || !('Notification' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const reg = await navigator.serviceWorker.ready;
  const vapidKey = await getVapidPublicKey();

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  const hash = await registerPushSubscription(sub);
  localStorage.setItem(ENDPOINT_HASH_KEY, hash);
  return hash;
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
  }
  const hash = localStorage.getItem(ENDPOINT_HASH_KEY);
  if (hash) {
    await unregisterPushSubscription(hash);
    localStorage.removeItem(ENDPOINT_HASH_KEY);
  }
}
