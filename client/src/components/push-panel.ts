import { html, render } from 'lit-html';
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '../push/subscription.ts';
import { getAllPending, dequeue, countPending } from '../db/queue.ts';
import { createReport, ApiError } from '../api/reports.ts';
import { showToast } from './toast-manager.ts';

export async function createPushPanel(): Promise<HTMLElement> {
  const panel = document.createElement('div');
  panel.className = 'push-panel';

  let state: PushState = { supported: false, permission: 'default', subscribed: false };
  let pendingCount = 0;
  let syncing = false;

  async function refresh(): Promise<void> {
    [state, pendingCount] = await Promise.all([getPushState(), countPending()]);
    renderPanel();
  }

  function renderPanel(): void {
    render(
      html`
        <div class="push-panel__inner">
          ${state.supported
            ? html`
                <div class="push-panel__row">
                  <span class="push-panel__label">Potisna obvestila:</span>
                  ${state.subscribed
                    ? html`
                        <span class="push-panel__status push-panel__status--on">Vklopljeno</span>
                        <button
                          type="button"
                          class="btn btn--secondary btn--sm"
                          @click=${handleUnsubscribe}
                        >
                          Izklopi
                        </button>
                      `
                    : state.permission === 'denied'
                      ? html`<span class="push-panel__status push-panel__status--blocked"
                          >Blokirano v brskalniku</span
                        >`
                      : html`
                          <button
                            type="button"
                            class="btn btn--secondary btn--sm"
                            @click=${handleSubscribe}
                          >
                            Vklopi obvestila o statusu
                          </button>
                        `}
                </div>
              `
            : ''}
          ${pendingCount > 0
            ? html`
                <div class="push-panel__row push-panel__row--sync">
                  <span class="push-panel__label">
                    ${pendingCount} ${pendingCount === 1 ? 'prijava čaka' : 'prijave čakajo'} na
                    pošiljanje
                  </span>
                  <button
                    type="button"
                    class="btn btn--primary btn--sm"
                    ?disabled=${syncing}
                    aria-busy=${syncing ? 'true' : 'false'}
                    @click=${handleManualSync}
                  >
                    ${syncing ? 'Pošiljam…' : 'Pošlji zdaj'}
                  </button>
                </div>
              `
            : ''}
        </div>
      `,
      panel,
    );
  }

  async function handleSubscribe(): Promise<void> {
    try {
      const hash = await subscribeToPush();
      if (hash) {
        state = { ...state, subscribed: true, permission: 'granted' };
        showToast('Obvestila o statusu prijav so bila vklopljena.', { type: 'success' });
      } else {
        showToast('Obvestil ni mogoče vklopiti. Preverite dovoljenja brskalnika.', {
          type: 'error',
        });
      }
    } catch {
      showToast('Napaka pri vklopu obvestil.', { type: 'error' });
    }
    renderPanel();
  }

  async function handleUnsubscribe(): Promise<void> {
    try {
      await unsubscribeFromPush();
      state = { ...state, subscribed: false };
      showToast('Obvestila so bila izklopljena.', { type: 'info' });
    } catch {
      showToast('Napaka pri izklopu obvestil.', { type: 'error' });
    }
    renderPanel();
  }

  async function handleManualSync(): Promise<void> {
    syncing = true;
    renderPanel();

    const pending = await getAllPending();
    let successCount = 0;
    let offlineHit = false;

    for (const report of pending) {
      const fd = new FormData();
      fd.set('clientId', report.clientId);
      fd.set('title', report.title);
      fd.set('category', report.category);
      fd.set('description', report.description);
      fd.set('lat', String(report.lat));
      fd.set('lng', String(report.lng));
      if (report.address) fd.set('address', report.address);
      if (report.photo) fd.set('photo', report.photo, 'photo.jpg');

      try {
        const result = await createReport(fd);
        await dequeue(result.clientId);
        successCount++;
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) {
          offlineHit = true;
          break;
        }
        // Server error — skip this entry (will stay in queue)
      }
    }

    if (offlineHit) {
      showToast('Brez povezave — prijave bodo poslane samodejno.', { type: 'info' });
    } else if (successCount > 0) {
      const word = successCount === 1 ? 'prijava je bila' : 'prijave so bile';
      showToast(`${String(successCount)} ${word} uspešno oddane.`, { type: 'success' });
    }

    syncing = false;
    pendingCount = await countPending();
    renderPanel();
  }

  await refresh();

  // Refresh panel when SW signals a sync completed
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type === 'report-synced') {
        void refresh();
      }
    });
  }

  return panel;
}
