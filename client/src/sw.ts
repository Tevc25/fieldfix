/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler, setDefaultHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { openDB } from 'idb';

declare const self: ServiceWorkerGlobalScope;

// ── Debug logging via BroadcastChannel ────────────────────────────────────
const swLog = new BroadcastChannel('sw-log');
function log(msg: string): void {
  swLog.postMessage({ ts: Date.now(), msg });
}

// ── Skip-waiting on request from main thread ───────────────────────────────
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    log('skip-waiting requested — activating new SW');
    void self.skipWaiting();
  }
});

// ── Claim all clients immediately on activation ────────────────────────────
clientsClaim();

// ── 1. App shell: precache all build artifacts ─────────────────────────────
// __WB_MANIFEST is injected by vite-plugin-pwa at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
log('precache routes registered');

// ── 2. OSM tile layer — StaleWhileRevalidate ───────────────────────────────
// Serve cached tiles immediately; refresh in background.
// Max 200 tiles, expire after 7 days so the cache stays manageable.
registerRoute(
  ({ url }: { url: URL }) => url.hostname === 'tile.openstreetmap.org',
  new StaleWhileRevalidate({
    cacheName: 'osm-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

// ── 3. GET /api/reports — NetworkFirst (3 s timeout) ──────────────────────
// Fresh data preferred; fall back to cache when offline.
registerRoute(
  ({ url, request }: { url: URL; request: Request }) =>
    url.pathname.startsWith('/api/reports') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-reports',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }),
    ],
  }),
);

// ── 4. POST /api/reports — NetworkOnly (Background Sync handles offline replay)
// POSTs must never be served from cache.
registerRoute(
  ({ url, request }: { url: URL; request: Request }) =>
    url.pathname === '/api/reports' && request.method === 'POST',
  new NetworkOnly(),
);

// ── 5. Nominatim geocoding — CacheFirst (30 days) ─────────────────────────
// Reverse-geocode results are stable; long TTL is appropriate.
registerRoute(
  ({ url }: { url: URL }) => url.hostname === 'nominatim.openstreetmap.org',
  new CacheFirst({
    cacheName: 'nominatim',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// ── 6. Navigation requests — NetworkFirst with offline fallback ────────────
// Tries the network; serves precached index.html on failure; final fallback is offline.html.
registerRoute(
  ({ request }: { request: Request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'navigations',
    networkTimeoutSeconds: 5,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// ── 7. Everything else cross-origin — NetworkOnly ─────────────────────────
setDefaultHandler(new NetworkOnly());

// ── Catch handler: offline fallback for navigations ───────────────────────
setCatchHandler(async ({ request }: { request: Request }) => {
  if (request.mode === 'navigate') {
    log('offline navigation — serving offline.html');
    // Try precached shell first, then the standalone offline page
    const cached = await caches.match('/index.html');
    if (cached) return cached;
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
  }
  return Response.error();
});

// ── Background Sync: replay queued reports ────────────────────────────────
// 'SyncEvent' is not in TS WebWorker lib — cast from generic Event.
interface SyncEventLike extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

interface PendingItem {
  clientId: string;
  title: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  address?: string;
  photo?: Blob;
}

interface CreateReportResponse {
  id: string;
  clientId: string;
}

async function replayReportQueue(): Promise<void> {
  const db = await openDB('fieldfix', 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('pending-reports')) {
        database.createObjectStore('pending-reports', { keyPath: 'clientId' });
      }
    },
  });

  const pending = (await db.getAll('pending-reports')) as PendingItem[];
  log(`background sync: ${String(pending.length)} item(s) to replay`);

  for (const item of pending) {
    const fd = new FormData();
    fd.set('clientId', item.clientId);
    fd.set('title', item.title);
    fd.set('category', item.category);
    fd.set('description', item.description);
    fd.set('lat', String(item.lat));
    fd.set('lng', String(item.lng));
    if (item.address) fd.set('address', item.address);
    if (item.photo) fd.set('photo', item.photo, 'photo.jpg');

    const res = await fetch('/api/reports', { method: 'POST', body: fd });

    // 200 = already exists (idempotent), 201 = created; both are success
    if (res.status !== 200 && res.status !== 201) {
      // Non-retriable errors (4xx) — remove from queue to avoid repeated failures
      if (res.status >= 400 && res.status < 500) {
        await db.delete('pending-reports', item.clientId);
        log(
          `report ${item.clientId} rejected by server (${String(res.status)}) — removed from queue`,
        );
      } else {
        throw new Error(`replay failed: ${String(res.status)}`);
      }
      continue;
    }

    const data = (await res.json()) as CreateReportResponse;
    await db.delete('pending-reports', data.clientId);
    log(`report-synced: ${data.id}`);

    // Notify all open windows
    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    windowClients.forEach((c) =>
      c.postMessage({ type: 'report-synced', reportId: data.id, clientId: data.clientId }),
    );
  }
}

self.addEventListener('sync', (event: Event) => {
  const se = event as SyncEventLike;
  if (se.tag === 'report-submit') {
    log('background sync: report-submit triggered');
    se.waitUntil(replayReportQueue());
  }
});

// ── Push notifications ────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Oddano',
  in_review: 'V obravnavi',
  resolved: 'Rešeno',
  rejected: 'Zavrnjeno',
};

self.addEventListener('push', (event: PushEvent) => {
  interface PushPayload {
    type?: string;
    reportId?: string;
    newStatus?: string;
    note?: string;
  }

  const data = (event.data?.json() ?? {}) as PushPayload;
  if (data.type !== 'status_changed') return;

  const statusLabel = STATUS_LABELS[data.newStatus ?? ''] ?? data.newStatus ?? '';
  const body = `Status vaše prijave je bil spremenjen v: ${statusLabel}${data.note ? `\n${data.note}` : ''}`;

  log(`push received: ${data.reportId ?? 'unknown'} → ${statusLabel}`);

  // Cast needed because TS WebWorker lib lacks 'actions' on NotificationOptions
  const notifOptions = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `status-${data.reportId ?? ''}`,
    data: { reportId: data.reportId },
    actions: [{ action: 'open', title: 'Odpri prijavo' }],
  } as NotificationOptions;

  event.waitUntil(
    self.registration.showNotification('PrijaviMesto — Status posodobljen', notifOptions),
  );
});

// ── Notification click: open/focus the report page ────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const notifData = event.notification.data as { reportId?: string } | null;
  const reportId = notifData?.reportId;
  const url = reportId ? `/prijava/${reportId}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing window if one is already open
      for (const client of clients) {
        if ('focus' in client) {
          void (client as WindowClient).navigate(url);
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// ── Periodic Background Sync: daily report refresh ────────────────────────
self.addEventListener('periodicsync', (event: Event) => {
  const pse = event as unknown as { tag: string; waitUntil: (p: Promise<unknown>) => void };
  if (pse.tag === 'refresh-reports') {
    log('periodic sync: refreshing report list');
    pse.waitUntil(
      fetch('/api/reports?pageSize=100').then(async (res) => {
        if (res.ok) {
          const cache = await caches.open('api-reports');
          await cache.put('/api/reports?pageSize=100', res);
        }
      }),
    );
  }
});

log('service worker initialised');
