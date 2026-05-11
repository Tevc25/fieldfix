import './styles/global.css';
import 'leaflet/dist/leaflet.css';
import { defineRoute, initRouter } from './router.ts';
import { createReportListView } from './components/report-list.ts';
import { createReportFormView } from './components/report-form.ts';
import { createReportDetailView } from './components/report-detail.ts';
import { showToast } from './components/toast-manager.ts';
import { countPending } from './db/queue.ts';

// ── Route definitions ──────────────────────────────────────────────────────
defineRoute('/', () => createReportListView());
defineRoute('/prijavi', () => createReportFormView());
defineRoute('/prijava/:id', ({ id }) => createReportDetailView(id));

// ── SW registration ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Listen for SW log messages in development/testing
  const swLog = new BroadcastChannel('sw-log');
  swLog.addEventListener('message', (e: MessageEvent<{ ts: number; msg: string }>) => {
    console.warn('[SW]', new Date(e.data.ts).toISOString(), e.data.msg);
  });

  // Dynamically import the registered SW from vite-plugin-pwa
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh() {
          const banner = document.getElementById('sw-update-banner');
          if (banner) {
            banner.hidden = false;
            const btn = banner.querySelector<HTMLButtonElement>('#sw-update-btn');
            btn?.addEventListener('click', () => updateSW(true));
          }
        },
        onOfflineReady() {
          console.warn('[SW] App ready for offline use.');
        },
        onRegistered(r: ServiceWorkerRegistration | undefined) {
          if (!r) return;
          // Register periodic background sync for daily report refresh
          if ('periodicSync' in r) {
            (
              r as ServiceWorkerRegistration & {
                periodicSync: {
                  register: (tag: string, opts: { minInterval: number }) => Promise<void>;
                };
              }
            ).periodicSync
              .register('refresh-reports', { minInterval: 24 * 60 * 60 * 1000 })
              .catch(() => {
                // Permission not granted or unsupported — silent
              });
          }
        },
        onRegisterError(error: unknown) {
          console.warn('[SW] Registration failed:', error);
        },
      });
    })
    .catch((err: unknown) => {
      console.warn('[SW] vite-plugin-pwa virtual module not available:', err);
    });
}

// ── Mobile nav toggle ──────────────────────────────────────────────────────
function initMobileNav(): void {
  const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;

  // Show toggle on small screens
  const mq = window.matchMedia('(max-width: 600px)');
  function onMq(q: MediaQueryList | MediaQueryListEvent): void {
    toggle!.hidden = !q.matches;
    if (!q.matches) nav!.removeAttribute('hidden');
  }
  mq.addEventListener('change', onMq);
  onMq(mq);

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.setAttribute('aria-label', expanded ? 'Odpri navigacijo' : 'Zapri navigacijo');
    nav.toggleAttribute('hidden', expanded);
  });
}

// ── Badge API: reflect pending report count on app icon ───────────────────
async function updateBadge(): Promise<void> {
  if (!('setAppBadge' in navigator)) return;
  const count = await countPending();
  if (count > 0) {
    await (navigator as Navigator & { setAppBadge(n: number): Promise<void> }).setAppBadge(count);
  } else {
    await (navigator as Navigator & { clearAppBadge(): Promise<void> }).clearAppBadge();
  }
}

// ── SW message listener: background sync completions ──────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener(
    'message',
    (e: MessageEvent<{ type?: string; reportId?: string }>) => {
      if (e.data?.type === 'report-synced') {
        showToast('Čakajoča prijava je bila uspešno oddana!', { type: 'success' });
        void updateBadge();
      }
    },
  );
}

// Set initial badge on startup
void updateBadge();

// ── Boot ───────────────────────────────────────────────────────────────────
initMobileNav();
initRouter();
