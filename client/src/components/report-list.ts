import L from 'leaflet';
import { html, render } from 'lit-html';
import { listReports, ApiError } from '../api/reports.ts';
import type { Report, ReportStatus } from '@fieldfix/shared';
import { navigate } from '../router.ts';
import { createPushPanel } from './push-panel.ts';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-expect-error — Leaflet internal property
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

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
  damaged_sign: 'Poškodovana signalizacija',
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

type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g';
interface NetworkInformation extends EventTarget {
  readonly effectiveType: EffectiveType;
}

function getEffectiveType(): EffectiveType | null {
  const conn = (navigator as { connection?: NetworkInformation }).connection;
  return conn?.effectiveType ?? null;
}

function isSlowConnection(): boolean {
  const et = getEffectiveType();
  return et === 'slow-2g' || et === '2g';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function createReportListView(): HTMLElement {
  const root = document.createElement('div');

  // Push panel mounted asynchronously above the report list
  createPushPanel()
    .then((el) => root.prepend(el))
    .catch(() => {
      /* push not available */
    });

  const section = document.createElement('section');
  section.setAttribute('aria-label', 'Seznam prijav');
  root.appendChild(section);

  let map: L.Map | null = null;
  const markers: L.Marker[] = [];

  function renderView(reports: Report[]): void {
    document.title = 'Prijave — PrijaviMesto';
    const slowNet = isSlowConnection();

    const total = reports.length;
    const inReview = reports.filter((r) => r.status === 'in_review').length;
    const resolved = reports.filter((r) => r.status === 'resolved').length;
    const submitted = reports.filter((r) => r.status === 'submitted').length;

    render(
      html`
        <h1>Prijave</h1>

        <!-- Stats strip -->
        <div class="stats-strip" role="list" aria-label="Statistika prijav">
          <div class="stat-card" role="listitem">
            <div class="stat-card__value">${total}</div>
            <div class="stat-card__label">Skupaj</div>
          </div>
          <div class="stat-card" role="listitem">
            <div class="stat-card__value">${submitted}</div>
            <div class="stat-card__label">Čakajo</div>
          </div>
          <div class="stat-card" role="listitem">
            <div class="stat-card__value">${inReview}</div>
            <div class="stat-card__label">V obravnavi</div>
          </div>
          <div class="stat-card" role="listitem">
            <div class="stat-card__value">${resolved}</div>
            <div class="stat-card__label">Rešene</div>
          </div>
        </div>

        ${slowNet
          ? html`<div class="alert alert--info" role="status">
              <p>
                Zaznana počasna povezava (${getEffectiveType() ?? ''}) — zemljevid je skrit za
                prihranek podatkov.
              </p>
            </div>`
          : html`<div
              class="map-container"
              id="report-map"
              aria-label="Zemljevid prijav"
              role="img"
            ></div>`}

        <div class="reports-section__header">
          <h2 style="margin:0">Vse prijave</h2>
          <a
            href="/prijavi"
            class="btn btn--primary"
            @click=${(e: Event) => {
              e.preventDefault();
              navigate('/prijavi');
            }}
          >
            + Nova prijava
          </a>
        </div>

        ${reports.length === 0
          ? html`<div class="empty-state">
              <div class="empty-state__icon" aria-hidden="true">📋</div>
              <p class="empty-state__title">Ni prijav za prikaz</p>
              <p>Bodite prvi, ki prijavite težavo v vašem mestu.</p>
              <a
                href="/prijavi"
                class="btn btn--primary"
                @click=${(e: Event) => {
                  e.preventDefault();
                  navigate('/prijavi');
                }}
                >+ Nova prijava</a
              >
            </div>`
          : html`<ul class="report-cards">
              ${reports.map(
                (r) => html`
                  <li>
                    <a
                      href="/prijava/${r.id}"
                      class="report-card"
                      aria-label="${r.title}, status: ${STATUS_LABELS[r.status]}"
                      @click=${(e: Event) => {
                        e.preventDefault();
                        navigate(`/prijava/${r.id}`);
                      }}
                    >
                      <div class="report-card__top">
                        <span
                          class="category-badge category-badge--${r.category}"
                          aria-hidden="true"
                        >
                          ${CATEGORY_ICONS[r.category] ?? '📌'}
                          ${CATEGORY_LABELS[r.category] ?? r.category}
                        </span>
                        <span class="status-badge status-badge--${r.status}">
                          ${STATUS_LABELS[r.status]}
                        </span>
                      </div>
                      <p class="report-card__title">${r.title}</p>
                      ${r.address
                        ? html`<p class="report-card__location">
                            <span aria-hidden="true">📍</span>
                            <span>${r.address}</span>
                          </p>`
                        : ''}
                      <div class="report-card__footer">
                        <time datetime="${r.createdAt}">${formatDate(r.createdAt)}</time>
                        <span class="report-card__arrow" aria-hidden="true">→</span>
                      </div>
                    </a>
                  </li>
                `,
              )}
            </ul>`}
      `,
      section,
    );

    // Initialise Leaflet map after render — skipped on slow connections
    if (slowNet) return;
    window.requestAnimationFrame(() => {
      const mapEl = document.getElementById('report-map');
      if (!mapEl) return;

      if (!map) {
        map = L.map(mapEl).setView([46.5547, 15.6459], 13);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
      } else {
        markers.forEach((m) => m.remove());
        markers.length = 0;
      }

      reports.forEach((r) => {
        const marker = L.marker([r.lat, r.lng])
          .addTo(map!)
          .bindPopup(
            `<strong><a href="/prijava/${r.id}">${r.title}</a></strong><br>${STATUS_LABELS[r.status]}`,
          );
        markers.push(marker);
      });

      // Fit map to markers if any
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
      }
    });
  }

  function renderError(msg: string): void {
    render(
      html`
        <h1>Prijave</h1>
        <div class="alert alert--error" role="alert">
          <p>${msg}</p>
        </div>
      `,
      section,
    );
  }

  // Load data
  listReports({ pageSize: 100 })
    .then((result) => renderView(result.data))
    .catch((err: unknown) => {
      const msg = err instanceof ApiError ? err.message : 'Napaka pri nalaganju prijav.';
      renderError(msg);
    });

  return root;
}
