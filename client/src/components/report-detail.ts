import { html, render } from 'lit-html';
import { getReport, ApiError } from '../api/reports.ts';
import type { ReportDetail, ReportStatus, StatusHistoryEntry } from '@fieldfix/shared';
import { showToast } from './toast-manager.ts';
import { navigate } from '../router.ts';

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

const CATEGORY_ICONS: Record<string, string> = {
  pothole: '🕳️',
  broken_streetlight: '💡',
  graffiti: '🎨',
  illegal_dumping: '🗑️',
  damaged_sign: '🚧',
  other: '⚠️',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('sl-SI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function createReportDetailView(id: string): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'detail-heading');

  function renderDetail(report: ReportDetail): void {
    document.title = `${report.title} — PrijaviMesto`;
    const shareUrl = `${location.origin}/prijava/${report.id}`;
    const icon = CATEGORY_ICONS[report.category] ?? '📌';
    const categoryLabel = CATEGORY_LABELS[report.category] ?? report.category;

    render(
      html`
        <nav aria-label="Krušna pot" style="margin-bottom:var(--sp-4)">
          <a
            href="/"
            class="btn btn--secondary btn--sm"
            @click=${(e: Event) => {
              e.preventDefault();
              navigate('/');
            }}
            >← Nazaj na prijave</a
          >
        </nav>

        <!-- Hero card -->
        <div class="detail-hero">
          <div class="detail-hero__header">
            <span class="detail-hero__icon" aria-hidden="true">${icon}</span>
            <div class="detail-hero__meta">
              <h1 id="detail-heading" class="detail-hero__title">${report.title}</h1>
              <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;align-items:center">
                <span class="status-badge status-badge--${report.status}">
                  ${STATUS_LABELS[report.status]}
                </span>
                <span class="category-badge category-badge--${report.category}">
                  ${categoryLabel}
                </span>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap">
            ${'share' in navigator
              ? html`<button
                  type="button"
                  class="btn btn--secondary btn--sm"
                  @click=${async () => {
                    try {
                      await navigator.share({ title: report.title, url: shareUrl });
                    } catch {
                      /* cancelled */
                    }
                  }}
                >
                  Deli prijavo
                </button>`
              : ''}
            <button
              type="button"
              class="btn btn--secondary btn--sm"
              @click=${async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  showToast('Povezava kopirana', { type: 'success' });
                } catch {
                  showToast('Kopiranje ni uspelo', { type: 'error' });
                }
              }}
            >
              Kopiraj povezavo
            </button>
          </div>
        </div>

        <!-- Details grid -->
        <div class="detail-grid">
          <div class="detail-field">
            <div class="detail-field__label">Opis težave</div>
            <div class="detail-field__value">${report.description}</div>
          </div>
          <div class="detail-field">
            <div class="detail-field__label">Lokacija</div>
            <div class="detail-field__value">
              ${report.address
                ? html`<span>📍 ${report.address}</span>`
                : html`<span>📍 ${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}</span>`}
            </div>
          </div>
          <div class="detail-field">
            <div class="detail-field__label">Datum prijave</div>
            <div class="detail-field__value">
              <time datetime="${report.createdAt}">${formatDateTime(report.createdAt)}</time>
            </div>
          </div>
          <div class="detail-field">
            <div class="detail-field__label">Zadnja posodobitev</div>
            <div class="detail-field__value">
              <time datetime="${report.updatedAt}">${formatDateTime(report.updatedAt)}</time>
            </div>
          </div>
          ${report.photoUrl
            ? html`<div class="detail-field detail-field--full">
                <div class="detail-field__label">Fotografija</div>
                <div class="detail-field__value" style="margin-top:var(--sp-2)">
                  <img
                    src="${report.photoUrl}"
                    alt="Fotografija prijave: ${report.title}"
                    style="max-width:100%;max-height:400px;border-radius:var(--radius-md);object-fit:cover"
                  />
                </div>
              </div>`
            : ''}
        </div>

        <!-- Status history timeline -->
        <section aria-labelledby="history-heading">
          <h2 id="history-heading" style="margin-bottom:var(--sp-4)">Potek obravnave</h2>
          <ol class="timeline" aria-label="Spremembe statusa">
            ${report.statusHistory.map(
              (h: StatusHistoryEntry) => html`
                <li class="timeline__item">
                  <span class="timeline__dot timeline__dot--${h.status}" aria-hidden="true"></span>
                  <div class="timeline__status">${STATUS_LABELS[h.status]}</div>
                  <time class="timeline__date" datetime="${h.changedAt}">
                    ${formatDateTime(h.changedAt)}
                  </time>
                  ${h.note ? html`<p class="timeline__note">${h.note}</p>` : ''}
                </li>
              `,
            )}
          </ol>
        </section>
      `,
      section,
    );
  }

  function renderError(msg: string): void {
    document.title = 'Napaka — PrijaviMesto';
    render(
      html`
        <nav aria-label="Krušna pot" style="margin-bottom:var(--sp-4)">
          <a
            href="/"
            class="btn btn--secondary btn--sm"
            @click=${(e: Event) => {
              e.preventDefault();
              navigate('/');
            }}
            >← Nazaj na prijave</a
          >
        </nav>
        <div class="alert alert--error" role="alert"><p>${msg}</p></div>
      `,
      section,
    );
  }

  getReport(id)
    .then(renderDetail)
    .catch((err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Napaka pri nalaganju prijave.';
      renderError(msg);
    });

  return section;
}
