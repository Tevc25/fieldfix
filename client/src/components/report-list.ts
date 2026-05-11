import L from 'leaflet';
import { html, render } from 'lit-html';
import { listReports, ApiError } from '../api/reports.ts';
import type { Report, ReportStatus } from '@fieldfix/shared';
import { navigate } from '../router.ts';
import { createPushPanel } from './push-panel.ts';

// Fix Leaflet marker icon paths broken by bundlers
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

// Network Information API — detect slow connections to skip map tiles
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

    render(
      html`
        <h1>Prijave</h1>

        ${slowNet
          ? html`<div class="alert alert--info" role="status">
              <p>
                Zaznana počasna povezava (${getEffectiveType() ?? ''}) — zemljevid je skrit za
                prihranek podatkov.
              </p>
            </div>`
          : ''}
        ${slowNet
          ? ''
          : html`<div
              class="map-container"
              id="report-map"
              aria-label="Zemljevid prijav"
              role="img"
            ></div>`}

        <h2>Seznam vseh prijav</h2>
        <div class="data-table-wrap">
          <table class="data-table" aria-label="Tabela prijav">
            <thead>
              <tr>
                <th scope="col">Naslov</th>
                <th scope="col">Kategorija</th>
                <th scope="col">Status</th>
                <th scope="col">Lokacija</th>
                <th scope="col">Datum</th>
              </tr>
            </thead>
            <tbody>
              ${reports.length === 0
                ? html`<tr>
                    <td colspan="5">Ni prijav za prikaz.</td>
                  </tr>`
                : reports.map(
                    (r) => html`
                      <tr>
                        <td>
                          <a
                            href="/prijava/${r.id}"
                            @click=${(e: Event) => {
                              e.preventDefault();
                              navigate(`/prijava/${r.id}`);
                            }}
                            >${r.title}</a
                          >
                        </td>
                        <td>${CATEGORY_LABELS[r.category] ?? r.category}</td>
                        <td>
                          <span class="status-badge status-badge--${r.status}">
                            ${STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td>${r.address ?? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}</td>
                        <td>${new Date(r.createdAt).toLocaleDateString('sl-SI')}</td>
                      </tr>
                    `,
                  )}
            </tbody>
          </table>
        </div>

        <div class="form-actions">
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
