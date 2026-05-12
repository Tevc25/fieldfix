import { html, render } from 'lit-html';
import { getReport, ApiError } from '../api/reports.ts';
import type { ReportDetail, ReportStatus, StatusHistoryEntry } from '@fieldfix/shared';
import { showToast } from './toast-manager.ts';

const STATUS_LABELS: Record<ReportStatus, string> = {
  submitted: 'Oddano',
  in_review: 'V obravnavi',
  resolved: 'Rešeno',
  rejected: 'Zavrnjeno',
};

const CATEGORY_LABELS: Record<string, string> = {
  pothole: 'Udarna jama',
  broken_streetlight: 'Pokvarjena ulična svetilka',
  graffiti: 'Grafiti',
  illegal_dumping: 'Ilegalno odlaganje odpadkov',
  damaged_sign: 'Poškodovana prometna signalizacija',
  other: 'Drugo',
};

// Valid status transitions (mirrors server-side FSM)
const TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  submitted: ['in_review', 'rejected'],
  in_review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

async function patchStatus(
  id: string,
  status: ReportStatus,
  note: string,
  adminToken: string,
): Promise<void> {
  const res = await fetch(`/api/reports/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ status, note: note || undefined }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
  }
}

export function createReportDetailView(id: string): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'detail-heading');

  // Admin panel state
  let adminOpen = false;
  let adminToken = localStorage.getItem('fieldfix-admin-token') ?? '';
  let selectedStatus: ReportStatus | '' = '';
  let adminNote = '';
  let adminSubmitting = false;

  function renderDetail(report: ReportDetail): void {
    document.title = `${report.title} — PrijaviMesto`;

    const shareUrl = `${location.origin}/prijava/${report.id}`;
    const nextStatuses = TRANSITIONS[report.status];

    render(
      html`
        <nav aria-label="Krušna pot">
          <a href="/">← Vse prijave</a>
        </nav>
        <article>
          <header style="margin-bottom:1.5rem">
            <h1 id="detail-heading">${report.title}</h1>
            <span class="status-badge status-badge--${report.status}">
              ${STATUS_LABELS[report.status]}
            </span>
          </header>

          <dl>
            <div style="margin-bottom:1rem">
              <dt style="font-weight:700">Kategorija</dt>
              <dd>${CATEGORY_LABELS[report.category] ?? report.category}</dd>
            </div>
            <div style="margin-bottom:1rem">
              <dt style="font-weight:700">Opis</dt>
              <dd>${report.description}</dd>
            </div>
            <div style="margin-bottom:1rem">
              <dt style="font-weight:700">Lokacija</dt>
              <dd>${report.address ?? `${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}`}</dd>
            </div>
            <div style="margin-bottom:1rem">
              <dt style="font-weight:700">Datum prijave</dt>
              <dd>${new Date(report.createdAt).toLocaleString('sl-SI')}</dd>
            </div>
            ${report.photoUrl
              ? html`<div style="margin-bottom:1rem">
                  <dt style="font-weight:700">Fotografija</dt>
                  <dd>
                    <img
                      src="${report.photoUrl}"
                      alt="Fotografija prijave: ${report.title}"
                      style="max-width:100%;max-height:400px;border-radius:.5rem;object-fit:cover"
                    />
                  </dd>
                </div>`
              : ''}
            <div style="margin-bottom:1rem">
              <dt style="font-weight:700">ID prijave</dt>
              <dd>
                <code>${report.id}</code>
                <button
                  type="button"
                  class="btn btn--secondary"
                  style="margin-left:.5rem;padding:.25rem .75rem;font-size:.875rem"
                  @click=${async () => {
                    try {
                      await navigator.clipboard.writeText(report.id);
                      showToast('ID prijave kopiran v odložišče', { type: 'success' });
                    } catch {
                      showToast('Kopiranje ni uspelo', { type: 'error' });
                    }
                  }}
                >
                  Kopiraj ID
                </button>
              </dd>
            </div>
          </dl>

          ${'share' in navigator
            ? html`<button
                type="button"
                class="btn btn--secondary"
                @click=${async () => {
                  try {
                    await navigator.share({ title: report.title, url: shareUrl });
                  } catch {
                    // User cancelled or share failed — no action needed
                  }
                }}
              >
                Deli prijavo
              </button>`
            : ''}

          <section aria-labelledby="history-heading" style="margin-top:2rem">
            <h2 id="history-heading">Zgodovina statusov</h2>
            <ol aria-label="Spremembe statusa">
              ${report.statusHistory.map(
                (h: StatusHistoryEntry) => html`
                  <li style="margin-bottom:.75rem">
                    <strong>${STATUS_LABELS[h.status]}</strong>
                    <time datetime="${h.changedAt}">
                      — ${new Date(h.changedAt).toLocaleString('sl-SI')}
                    </time>
                    ${h.note ? html`<br /><em>${h.note}</em>` : ''}
                  </li>
                `,
              )}
            </ol>
          </section>

          <!-- Admin panel -->
          <section
            aria-labelledby="admin-heading"
            style="margin-top:2rem;border-top:1px solid var(--c-surface-2);padding-top:1.5rem"
          >
            <h2 id="admin-heading" style="font-size:1rem;color:var(--c-text-secondary)">
              Administracija
            </h2>
            ${!adminOpen
              ? html`<button
                  type="button"
                  class="btn btn--secondary btn--sm"
                  @click=${() => {
                    adminOpen = true;
                    selectedStatus = nextStatuses[0] ?? '';
                    renderDetail(report);
                  }}
                >
                  Spremeni status
                </button>`
              : html`
                  <form
                    @submit=${async (e: Event) => {
                      e.preventDefault();
                      if (!selectedStatus) return;
                      adminSubmitting = true;
                      renderDetail(report);
                      try {
                        if (adminToken) localStorage.setItem('fieldfix-admin-token', adminToken);
                        await patchStatus(report.id, selectedStatus, adminNote, adminToken);
                        showToast(`Status spremenjen v: ${STATUS_LABELS[selectedStatus]}`, {
                          type: 'success',
                        });
                        adminOpen = false;
                        adminNote = '';
                        selectedStatus = '';
                        const updated = await getReport(id);
                        renderDetail(updated);
                      } catch (err) {
                        adminSubmitting = false;
                        const msg = err instanceof ApiError ? err.message : 'Napaka';
                        showToast(msg, { type: 'error' });
                        renderDetail(report);
                      }
                    }}
                    style="display:flex;flex-direction:column;gap:.75rem;max-width:28rem"
                  >
                    ${nextStatuses.length === 0
                      ? html`<p style="color:var(--c-text-secondary);font-size:.875rem">
                          Status je končen — nadaljnje spremembe niso možne.
                        </p>`
                      : html`
                          <div class="form-group" style="margin-bottom:0">
                            <label class="form-label" for="admin-token">Admin žeton</label>
                            <input
                              class="form-input"
                              id="admin-token"
                              type="password"
                              autocomplete="current-password"
                              placeholder="dev-admin-token-fieldfix"
                              .value=${adminToken}
                              @input=${(e: Event) => {
                                adminToken = (e.target as HTMLInputElement).value;
                              }}
                            />
                          </div>
                          <div class="form-group" style="margin-bottom:0">
                            <label class="form-label" for="new-status">Nov status</label>
                            <select
                              class="form-select"
                              id="new-status"
                              @change=${(e: Event) => {
                                selectedStatus = (e.target as HTMLSelectElement)
                                  .value as ReportStatus;
                              }}
                            >
                              ${nextStatuses.map(
                                (s) =>
                                  html`<option value=${s} ?selected=${selectedStatus === s}>
                                    ${STATUS_LABELS[s]}
                                  </option>`,
                              )}
                            </select>
                          </div>
                          <div class="form-group" style="margin-bottom:0">
                            <label class="form-label" for="admin-note">Opomba (neobvezno)</label>
                            <input
                              class="form-input"
                              id="admin-note"
                              type="text"
                              placeholder="Npr. Delavci bodo prišli v torek."
                              .value=${adminNote}
                              @input=${(e: Event) => {
                                adminNote = (e.target as HTMLInputElement).value;
                              }}
                            />
                          </div>
                          <div style="display:flex;gap:.5rem">
                            <button
                              type="submit"
                              class="btn btn--primary btn--sm"
                              ?disabled=${adminSubmitting}
                              aria-busy=${adminSubmitting ? 'true' : 'false'}
                            >
                              ${adminSubmitting ? 'Pošiljam…' : 'Potrdi spremembo'}
                            </button>
                            <button
                              type="button"
                              class="btn btn--secondary btn--sm"
                              @click=${() => {
                                adminOpen = false;
                                renderDetail(report);
                              }}
                            >
                              Prekliči
                            </button>
                          </div>
                        `}
                  </form>
                `}
          </section>
        </article>
      `,
      section,
    );
  }

  function renderError(msg: string): void {
    document.title = 'Napaka — PrijaviMesto';
    render(html`<div class="alert alert--error" role="alert"><p>${msg}</p></div>`, section);
  }

  getReport(id)
    .then(renderDetail)
    .catch((err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Napaka pri nalaganju prijave.';
      renderError(msg);
    });

  return section;
}
