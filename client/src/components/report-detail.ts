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

export function createReportDetailView(id: string): HTMLElement {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'detail-heading');

  function renderDetail(report: ReportDetail): void {
    document.title = `${report.title} — PrijaviMesto`;

    const shareUrl = `${location.origin}/prijava/${report.id}`;

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
