/**
 * k6 mixed-workload scenario for FieldFix server comparison.
 * Workload: 80% GET /api/reports, 15% POST /api/reports, 5% PATCH status
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 VARIANT=node   k6 run reports-scenario.js
 *   BASE_URL=http://localhost:3001 VARIANT=bun    k6 run reports-scenario.js
 *   BASE_URL=http://localhost:3002 VARIANT=deno   k6 run reports-scenario.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    // p95 under 500ms; allow 422 PATCH responses in failure rate check
    http_req_duration: ['p(95)<500'],
    'http_req_failed{scenario:default}': ['rate<0.25'], // 422 PATCH + potential POST validation ≤25%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = 'dev-admin-token-fieldfix';
const BOUNDARY = '----k6FieldFixBoundary7MA4YWxkTrZu0gW';

// Seeded report IDs for PATCH workload
const REPORT_IDS = [
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000006',
  'a1000000-0000-0000-0000-000000000007',
  'a1000000-0000-0000-0000-000000000008',
  'a1000000-0000-0000-0000-000000000009',
  'a1000000-0000-0000-0000-000000000010',
];

const CATEGORIES = [
  'pothole',
  'broken_streetlight',
  'graffiti',
  'illegal_dumping',
  'damaged_sign',
  'other',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Build a proper multipart/form-data body string from a plain-object map. */
function buildMultipart(fields) {
  let body = '';
  for (const [name, value] of Object.entries(fields)) {
    body += `--${BOUNDARY}\r\n`;
    body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
    body += `${value}\r\n`;
  }
  body += `--${BOUNDARY}--\r\n`;
  return body;
}

const MULTIPART_HEADERS = {
  'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
};

export default function () {
  const roll = Math.random();

  if (roll < 0.8) {
    // ── 80% GET list ────────────────────────────────────────────────────────
    const res = http.get(`${BASE_URL}/api/reports?page=1&pageSize=20`);
    check(res, {
      'GET /api/reports → 200': (r) => r.status === 200,
      'has data array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body).data);
        } catch {
          return false;
        }
      },
    });
  } else if (roll < 0.95) {
    // ── 15% POST create (proper multipart/form-data) ─────────────────────────
    const body = buildMultipart({
      clientId: uuid4(),
      title: `Okvara ${pick(['udarna jama', 'pokvarjena svetilka', 'grafiti', 'odpadki', 'znak'])} k6`,
      category: pick(CATEGORIES),
      description:
        'Opis napake za obremenitveno testiranje sistema PrijaviMesto v okolici Maribora.',
      lat: (46.5 + Math.random() * 0.1).toFixed(6),
      lng: (15.6 + Math.random() * 0.1).toFixed(6),
    });
    const res = http.post(`${BASE_URL}/api/reports`, body, { headers: MULTIPART_HEADERS });
    check(res, {
      'POST /api/reports → 201 or 200': (r) => r.status === 201 || r.status === 200,
    });
  } else {
    // ── 5% PATCH status ─────────────────────────────────────────────────────
    // 422 expected once seeded reports exhaust transitions — counts throughput
    const id = pick(REPORT_IDS);
    const res = http.patch(
      `${BASE_URL}/api/reports/${id}/status`,
      JSON.stringify({ status: 'in_review', note: 'k6 benchmark' }),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': ADMIN_TOKEN,
        },
      },
    );
    check(res, {
      'PATCH status → 200 or 422': (r) => r.status === 200 || r.status === 422,
    });
  }

  sleep(0.01);
}

export function handleSummary(data) {
  const variant = __ENV.VARIANT || 'unknown';
  return {
    [`../results/k6-${variant}.json`]: JSON.stringify(data, null, 2),
  };
}
