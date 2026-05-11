import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { z } from 'zod';
import type { ReportCategory, ReportStatus } from '@fieldfix/shared';
import { getDb, sha256 } from './db.ts';
import { initVapid, sendStatusChangedPush } from './push.ts';

const __dirname = new URL('.', import.meta.url).pathname;
const UPLOADS_DIR = join(__dirname, '../../uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

const ADMIN_TOKEN = Deno.env.get('ADMIN_TOKEN') ?? 'dev-admin-token-fieldfix';

// ── Validation schemas ────────────────────────────────────────────────────────
const ReportStatusSchema = z.enum(['submitted', 'in_review', 'resolved', 'rejected']);

const CreateReportFieldsSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(3).max(120),
  category: z.enum([
    'pothole',
    'broken_streetlight',
    'graffiti',
    'illegal_dumping',
    'damaged_sign',
    'other',
  ]),
  description: z.string().min(10).max(2000),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  address: z.string().max(255).optional(),
});

const UpdateStatusSchema = z.object({
  status: ReportStatusSchema,
  note: z.string().max(500).optional(),
});

const CreateSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

const ListQuerySchema = z.object({
  status: ReportStatusSchema.optional(),
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Status FSM ────────────────────────────────────────────────────────────────
const ALLOWED: Record<string, string[]> = {
  submitted: ['in_review'],
  in_review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

// ── Row mappers ───────────────────────────────────────────────────────────────
interface ReportRow {
  id: string;
  client_id: string;
  title: string;
  category: ReportCategory;
  description: string;
  lat: number;
  lng: number;
  address: string | null;
  photo_url: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

interface HistoryRow {
  id: string;
  report_id: string;
  status: ReportStatus;
  note: string | null;
  changed_at: string;
}

function rowToReport(r: ReportRow) {
  return {
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    category: r.category,
    description: r.description,
    lat: r.lat,
    lng: r.lng,
    address: r.address ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToHistory(r: HistoryRow) {
  return {
    id: r.id,
    reportId: r.report_id,
    status: r.status,
    note: r.note ?? undefined,
    changedAt: r.changed_at,
  };
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/png': '.png',
};

const MIME_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function nowTs(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
initVapid();

const app = new Hono();
app.use('*', cors());

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (c) =>
  c.json({ status: 'ok', variant: 'deno-hono', ts: new Date().toISOString() }),
);

// ── VAPID public key ──────────────────────────────────────────────────────────
app.get('/api/vapid-public-key', (c) => c.json({ publicKey: initVapid().publicKey }));

// ── POST /api/reports ─────────────────────────────────────────────────────────
app.post('/api/reports', async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: 'BadRequest', message: 'Neveljaven FormData' }, 400);
  }

  const db = getDb();
  let photoUrl: string | undefined;
  const photoEntry = form.get('photo');
  const photo = photoEntry instanceof File ? photoEntry : null;

  if (photo && photo.size > 0) {
    if (!MIME_EXT[photo.type]) {
      return c.json({ error: 'BadRequest', message: 'Slika mora biti JPEG, WebP ali PNG' }, 400);
    }
    const filename = `${randomUUID()}${MIME_EXT[photo.type]}`;
    await Deno.writeFile(join(UPLOADS_DIR, filename), new Uint8Array(await photo.arrayBuffer()));
    photoUrl = `/uploads/${filename}`;
  }

  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') fields[k] = v;
  }

  const parsed = CreateReportFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    return c.json(
      { error: 'BadRequest', message: 'Validacija ni uspela', details: parsed.error.errors },
      400,
    );
  }

  const { clientId, title, category, description, lat, lng, address } = parsed.data;

  const existing = db
    .prepare('SELECT id, client_id, status, created_at FROM reports WHERE client_id = ?')
    .get(clientId) as Pick<ReportRow, 'id' | 'client_id' | 'status' | 'created_at'> | undefined;
  if (existing) {
    return c.json({
      id: existing.id,
      clientId: existing.client_id,
      status: existing.status,
      createdAt: existing.created_at,
    });
  }

  const id = randomUUID();
  const now = nowTs();

  db.prepare(
    `INSERT INTO reports
       (id, client_id, title, category, description, lat, lng, address, photo_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`,
  ).run(
    id,
    clientId,
    title,
    category,
    description,
    lat,
    lng,
    address ?? null,
    photoUrl ?? null,
    now,
    now,
  );

  db.prepare(
    `INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES (?, ?, 'submitted', NULL, ?)`,
  ).run(randomUUID(), id, now);

  return c.json({ id, clientId, status: 'submitted', createdAt: now }, 201);
});

// ── GET /api/reports ──────────────────────────────────────────────────────────
app.get('/api/reports', (c) => {
  const parsed = ListQuerySchema.safeParse({
    status: c.req.query('status'),
    bbox: c.req.query('bbox'),
    page: c.req.query('page'),
    pageSize: c.req.query('pageSize'),
  });
  if (!parsed.success) {
    return c.json({ error: 'BadRequest', message: 'Neveljaven query parameter' }, 400);
  }

  const { status, bbox, page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;

  const conds: string[] = [];
  const params: (string | number)[] = [];
  if (status) {
    conds.push('status = ?');
    params.push(status);
  }
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
    conds.push('lng BETWEEN ? AND ? AND lat BETWEEN ? AND ?');
    params.push(minLng, maxLng, minLat, maxLat);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const db = getDb();

  const total = (
    db.prepare(`SELECT COUNT(*) as n FROM reports ${where}`).get(...params) as { n: number }
  ).n;
  const rows = db
    .prepare(`SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...[...params, pageSize, offset]) as ReportRow[];

  return c.json({ data: rows.map(rowToReport), total, page, pageSize });
});

// ── GET /api/reports/:id ──────────────────────────────────────────────────────
app.get('/api/reports/:id', (c) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(c.req.param('id')) as
    | ReportRow
    | undefined;
  if (!row) return c.json({ error: 'NotFound', message: 'Prijava ni bila najdena' }, 404);

  const history = db
    .prepare('SELECT * FROM status_history WHERE report_id = ? ORDER BY changed_at ASC')
    .all(c.req.param('id')) as HistoryRow[];

  return c.json({ ...rowToReport(row), statusHistory: history.map(rowToHistory) });
});

// ── PATCH /api/reports/:id/status ────────────────────────────────────────────
app.patch('/api/reports/:id/status', async (c) => {
  if (c.req.header('x-admin-token') !== ADMIN_TOKEN) {
    return c.json({ error: 'Unauthorized', message: 'Neveljaven ali manjkajoč admin žeton' }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'BadRequest', message: 'Neveljaven JSON' }, 400);
  }

  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'BadRequest', message: 'Neveljaven body' }, 400);

  const { status: newStatus, note } = parsed.data;
  const db = getDb();
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(c.req.param('id')) as
    | ReportRow
    | undefined;
  if (!row) return c.json({ error: 'NotFound', message: 'Prijava ni bila najdena' }, 404);

  if (!(ALLOWED[row.status] ?? []).includes(newStatus)) {
    return c.json(
      {
        error: 'UnprocessableEntity',
        message: `Prehod iz '${row.status}' v '${newStatus}' ni dovoljen`,
      },
      422,
    );
  }

  const now = nowTs();
  db.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').run(
    newStatus,
    now,
    c.req.param('id'),
  );
  db.prepare(
    'INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES (?, ?, ?, ?, ?)',
  ).run(randomUUID(), c.req.param('id'), newStatus, note ?? null, now);

  const updated = db
    .prepare('SELECT * FROM reports WHERE id = ?')
    .get(c.req.param('id')) as ReportRow;
  sendStatusChangedPush(db, { reportId: c.req.param('id'), newStatus, note }).catch(console.error);
  return c.json(rowToReport(updated));
});

// ── POST /api/subscriptions ───────────────────────────────────────────────────
app.post('/api/subscriptions', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'BadRequest', message: 'Neveljaven JSON' }, 400);
  }

  const parsed = CreateSubscriptionSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: 'BadRequest', message: 'Neveljaven format naročnine' }, 400);

  const { endpoint, keys } = parsed.data;
  const endpointHash = sha256(endpoint);
  const db = getDb();

  if (db.prepare('SELECT 1 FROM subscriptions WHERE endpoint_hash = ?').get(endpointHash)) {
    return c.json({ endpointHash });
  }

  db.prepare(
    'INSERT INTO subscriptions (endpoint_hash, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
  ).run(endpointHash, endpoint, keys.p256dh, keys.auth);

  return c.json({ endpointHash }, 201);
});

// ── DELETE /api/subscriptions/:endpointHash ───────────────────────────────────
app.delete('/api/subscriptions/:endpointHash', (c) => {
  const db = getDb();
  const result = db
    .prepare('DELETE FROM subscriptions WHERE endpoint_hash = ?')
    .run(c.req.param('endpointHash')) as { changes: number };

  if (result.changes === 0) {
    return c.json({ error: 'NotFound', message: 'Naročnina ni bila najdena' }, 404);
  }
  return new Response(null, { status: 204 });
});

// ── GET /uploads/:filename ────────────────────────────────────────────────────
app.get('/uploads/:filename', async (c) => {
  const filename = basename(c.req.param('filename'));
  const filePath = join(UPLOADS_DIR, filename);
  try {
    const data = await Deno.readFile(filePath);
    const ct = MIME_TYPE[extname(filename).toLowerCase()] ?? 'application/octet-stream';
    return new Response(data, { headers: { 'Content-Type': ct } });
  } catch {
    return c.json({ error: 'NotFound', message: 'Datoteka ni bila najdena' }, 404);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const port = Number(Deno.env.get('PORT') ?? 3002);
console.log(`[deno-hono] Listening on http://localhost:${port}`);
Deno.serve({ port }, app.fetch);
