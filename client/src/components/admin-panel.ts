import { html, render } from 'lit-html';
import { listReports, ApiError } from '../api/reports.ts';
import type { Report, ReportStatus } from '@fieldfix/shared';
import { showToast } from './toast-manager.ts';
import { navigate } from '../router.ts';

const ADMIN_PASSWORD = 'admin123';
const ADMIN_API_TOKEN = 'dev-admin-token-fieldfix';
const SESSION_KEY = 'fieldfix-admin-auth';

const STATUS_LABELS: Record<ReportStatus, string> = {
  submitted: 'Oddano',
  in_review: 'V obravnavi',
  resolved: 'Rešeno',
  rejected: 'Zavrnjeno',
};

const CATEGORY_LABELS: Record<string, string> = {
  pothole: 'Udarna jama',
  broken_streetlight: 'Pokvarjena svetilka',
  graffiti: 'Grafiti',
  illegal_dumping: 'Ilegalno odlaganje',
  damaged_sign: 'Poškodovana sign.',
  other: 'Drugo',
};

const TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  submitted: ['in_review', 'rejected'],
  in_review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

async function deleteReport(id: string): Promise<void> {
  const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': ADMIN_API_TOKEN },
  });
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
  }
}

async function patchStatus(id: string, status: ReportStatus, note: string): Promise<void> {
  const res = await fetch(`/api/reports/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': ADMIN_API_TOKEN },
    body: JSON.stringify({ status, note: note.trim() || undefined }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
  }
}

export function createAdminPanelView(): HTMLElement {
  const container = document.createElement('div');

  if (sessionStorage.getItem(SESSION_KEY) !== '1') {
    renderLogin(container);
  } else {
    void renderDashboard(container);
  }

  return container;
}

function renderLogin(container: HTMLElement): void {
  document.title = 'Admin — PrijaviMesto';
  let pwd = '';
  let error = '';

  function doRender(): void {
    render(
      html`
        <div class="admin-login">
          <div class="admin-login__box">
            <span class="admin-login__icon" aria-hidden="true">🔐</span>
            <h1 class="admin-login__title">Admin panel</h1>
            <p class="admin-login__subtitle">Vnesite admin geslo za dostop do nadzorne plošče.</p>
            ${error
              ? html`<div
                  class="alert alert--error"
                  role="alert"
                  style="text-align:left;margin-bottom:var(--sp-4)"
                >
                  <p>${error}</p>
                </div>`
              : ''}
            <form @submit=${handleLogin} style="text-align:left">
              <div class="form-group">
                <label class="form-label" for="admin-pwd">Geslo</label>
                <input
                  class="form-input"
                  id="admin-pwd"
                  type="password"
                  autocomplete="current-password"
                  required
                  aria-required="true"
                  @input=${(e: Event) => {
                    pwd = (e.target as HTMLInputElement).value;
                  }}
                />
              </div>
              <button type="submit" class="btn btn--primary" style="width:100%">Prijava</button>
            </form>
          </div>
        </div>
      `,
      container,
    );
    // Focus password input after render
    container.querySelector<HTMLInputElement>('#admin-pwd')?.focus();
  }

  function handleLogin(e: Event): void {
    e.preventDefault();
    if (pwd === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      void renderDashboard(container);
    } else {
      error = 'Napačno geslo. Poskusite znova.';
      doRender();
    }
  }

  doRender();
}

async function renderDashboard(container: HTMLElement): Promise<void> {
  document.title = 'Admin — PrijaviMesto';

  let reports: Report[] = [];
  let loading = true;
  let filterStatus: ReportStatus | 'all' = 'all';
  let expandedId: string | null = null;
  const selectedStatus: Record<string, ReportStatus | ''> = {};
  const noteValues: Record<string, string> = {};
  let submittingId: string | null = null;

  function logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    navigate('/admin');
  }

  function filteredReports(): Report[] {
    if (filterStatus === 'all') return reports;
    return reports.filter((r) => r.status === filterStatus);
  }

  function doRender(): void {
    const displayed = filteredReports();
    const total = reports.length;
    const counts = {
      submitted: reports.filter((r) => r.status === 'submitted').length,
      in_review: reports.filter((r) => r.status === 'in_review').length,
      resolved: reports.filter((r) => r.status === 'resolved').length,
      rejected: reports.filter((r) => r.status === 'rejected').length,
    };

    render(
      html`
        <div class="admin-dash__header">
          <div>
            <h1 class="admin-dash__title">Nadzorna plošča</h1>
            <p class="admin-dash__subtitle">Upravljanje prijav komunalnih okvar</p>
          </div>
          <button type="button" class="btn btn--secondary btn--sm" @click=${logout}>Odjava</button>
        </div>

        <!-- Stats -->
        <div
          class="stats-strip"
          role="list"
          aria-label="Statistika prijav"
          style="margin-bottom:var(--sp-5)"
        >
          <div class="stat-card" role="listitem">
            <div class="stat-card__value">${total}</div>
            <div class="stat-card__label">Skupaj</div>
          </div>
          <div class="stat-card" role="listitem">
            <div class="stat-card__value">${counts.submitted}</div>
            <div class="stat-card__label">Čakajo</div>
          </div>
          <div class="stat-card" role="listitem">
            <div class="stat-card__value">${counts.in_review}</div>
            <div class="stat-card__label">V obravnavi</div>
          </div>
          <div class="stat-card" role="listitem">
            <div class="stat-card__value">${counts.resolved}</div>
            <div class="stat-card__label">Rešene</div>
          </div>
          <div class="stat-card" role="listitem">
            <div class="stat-card__value">${counts.rejected}</div>
            <div class="stat-card__label">Zavrnjene</div>
          </div>
        </div>

        ${loading
          ? html`<div class="loading-shell" aria-busy="true">
              <div class="loading-spinner" aria-hidden="true"></div>
            </div>`
          : html`
              <!-- Filters -->
              <div class="admin-filters" role="group" aria-label="Filter po statusu">
                ${(['all', 'submitted', 'in_review', 'resolved', 'rejected'] as const).map(
                  (s) => html`
                    <button
                      type="button"
                      class="admin-filter-btn ${filterStatus === s
                        ? 'admin-filter-btn--active'
                        : ''}"
                      aria-pressed="${filterStatus === s ? 'true' : 'false'}"
                      @click=${() => {
                        filterStatus = s;
                        expandedId = null;
                        doRender();
                      }}
                    >
                      ${s === 'all' ? 'Vse' : STATUS_LABELS[s]}
                      ${s === 'all' ? `(${total})` : `(${counts[s]})`}
                    </button>
                  `,
                )}
              </div>

              <!-- Report list -->
              ${displayed.length === 0
                ? html`<div class="empty-state">
                    <div class="empty-state__icon" aria-hidden="true">✅</div>
                    <p class="empty-state__title">Ni prijav za prikaz</p>
                  </div>`
                : html`<div class="admin-reports">
                    ${displayed.map((r) => {
                      const nextStatuses = TRANSITIONS[r.status];
                      const isExpanded = expandedId === r.id;
                      const isSubmitting = submittingId === r.id;

                      if (!(r.id in selectedStatus) && nextStatuses.length > 0) {
                        selectedStatus[r.id] = nextStatuses[0];
                      }

                      return html`
                        <div class="admin-report-row">
                          <div class="admin-report-row__main">
                            <div class="admin-report-row__title">
                              <a
                                href="/prijava/${r.id}"
                                @click=${(e: Event) => {
                                  e.preventDefault();
                                  navigate(`/prijava/${r.id}`);
                                }}
                                >${r.title}</a
                              >
                            </div>
                            <div class="admin-report-row__meta">
                              <span class="category-badge category-badge--${r.category}">
                                ${CATEGORY_LABELS[r.category] ?? r.category}
                              </span>
                              <span class="status-badge status-badge--${r.status}">
                                ${STATUS_LABELS[r.status]}
                              </span>
                              <span class="admin-report-row__date">
                                ${new Date(r.createdAt).toLocaleDateString('sl-SI')}
                              </span>
                              ${nextStatuses.length > 0
                                ? html`<button
                                    type="button"
                                    class="btn btn--secondary btn--sm"
                                    aria-expanded="${isExpanded ? 'true' : 'false'}"
                                    @click=${() => {
                                      expandedId = isExpanded ? null : r.id;
                                      doRender();
                                    }}
                                  >
                                    ${isExpanded ? 'Zapri' : 'Uredi status'}
                                  </button>`
                                : html`<span
                                    style="font-size:var(--text-sm);color:var(--c-text-secondary)"
                                    >Zaključeno</span
                                  >`}
                              <button
                                type="button"
                                class="btn btn--danger btn--sm"
                                @click=${async () => {
                                  if (!confirm(`Izbriši prijavo "${r.title}"?`)) return;
                                  try {
                                    await deleteReport(r.id);
                                    reports = reports.filter((x) => x.id !== r.id);
                                    if (expandedId === r.id) expandedId = null;
                                    doRender();
                                    showToast('Prijava izbrisana', { type: 'success' });
                                  } catch (err) {
                                    const msg = err instanceof ApiError ? err.message : 'Napaka';
                                    showToast(msg, { type: 'error' });
                                  }
                                }}
                              >
                                Izbriši
                              </button>
                            </div>
                          </div>

                          ${isExpanded && nextStatuses.length > 0
                            ? html`
                                <form
                                  class="admin-change-form"
                                  @submit=${async (e: Event) => {
                                    e.preventDefault();
                                    const newStatus = selectedStatus[r.id];
                                    if (!newStatus) return;
                                    submittingId = r.id;
                                    doRender();
                                    try {
                                      await patchStatus(r.id, newStatus, noteValues[r.id] ?? '');
                                      showToast(`Status spremenjen → ${STATUS_LABELS[newStatus]}`, {
                                        type: 'success',
                                      });
                                      expandedId = null;
                                      submittingId = null;
                                      // Reload reports
                                      const result = await listReports({ pageSize: 1000 });
                                      reports = result.data;
                                      doRender();
                                    } catch (err) {
                                      submittingId = null;
                                      const msg = err instanceof ApiError ? err.message : 'Napaka';
                                      showToast(msg, { type: 'error' });
                                      doRender();
                                    }
                                  }}
                                >
                                  <div class="form-group">
                                    <label class="form-label" for="status-${r.id}"
                                      >Nov status</label
                                    >
                                    <select
                                      class="form-select"
                                      id="status-${r.id}"
                                      @change=${(e: Event) => {
                                        selectedStatus[r.id] = (e.target as HTMLSelectElement)
                                          .value as ReportStatus;
                                      }}
                                    >
                                      ${nextStatuses.map(
                                        (s) =>
                                          html`<option
                                            value="${s}"
                                            ?selected=${selectedStatus[r.id] === s}
                                          >
                                            ${STATUS_LABELS[s]}
                                          </option>`,
                                      )}
                                    </select>
                                  </div>
                                  <div class="form-group">
                                    <label class="form-label" for="note-${r.id}"
                                      >Opomba (neobvezno)</label
                                    >
                                    <input
                                      class="form-input"
                                      id="note-${r.id}"
                                      type="text"
                                      placeholder="Npr. Delavci prihajajo v torek."
                                      .value=${noteValues[r.id] ?? ''}
                                      @input=${(e: Event) => {
                                        noteValues[r.id] = (e.target as HTMLInputElement).value;
                                      }}
                                    />
                                  </div>
                                  <div
                                    style="display:flex;gap:var(--sp-2);align-items:flex-end;padding-bottom:var(--sp-5)"
                                  >
                                    <button
                                      type="submit"
                                      class="btn btn--primary btn--sm"
                                      ?disabled=${isSubmitting}
                                      aria-busy="${isSubmitting ? 'true' : 'false'}"
                                    >
                                      ${isSubmitting ? 'Shranjujem…' : 'Potrdi'}
                                    </button>
                                    <button
                                      type="button"
                                      class="btn btn--secondary btn--sm"
                                      @click=${() => {
                                        expandedId = null;
                                        doRender();
                                      }}
                                    >
                                      Prekliči
                                    </button>
                                  </div>
                                </form>
                              `
                            : ''}
                        </div>
                      `;
                    })}
                  </div>`}
            `}
      `,
      container,
    );
  }

  doRender();

  try {
    const result = await listReports({ pageSize: 1000 });
    reports = result.data;
    loading = false;
    doRender();
  } catch {
    loading = false;
    showToast('Napaka pri nalaganju prijav.', { type: 'error' });
    doRender();
  }
}
