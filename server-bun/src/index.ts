import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';
import type { ReportCategory, ReportStatus } from '@fieldfix/shared';
import { getDb, sha256 } from './db.ts';
import { initVapid, sendStatusChangedPush } from './push.ts';

const UPLOADS_DIR = join(import.meta.dir, '../../uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

const ADMIN_TOKEN = process.env['ADMIN_TOKEN'] ?? 'dev-admin-token-fieldfix';

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

function nowTs(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function bad(set: { status?: number | string }, msg: string, details?: unknown) {
  set.status = 400;
  return { error: 'BadRequest', message: msg, ...(details ? { details } : {}) };
}

// ── Boot ──────────────────────────────────────────────────────────────────────
initVapid();

const app = new Elysia()
  .use(cors())

  // ── Health ──────────────────────────────────────────────────────────────────
  .get('/api/health', () => ({
    status: 'ok',
    variant: 'bun-elysia',
    ts: new Date().toISOString(),
  }))

  // ── VAPID public key ────────────────────────────────────────────────────────
  .get('/api/vapid-public-key', () => ({ publicKey: initVapid().publicKey }))

  // ── POST /api/reports ───────────────────────────────────────────────────────
  .post('/api/reports', async ({ request, set }) => {
    const form = await request.formData().catch(() => null);
    if (!form) return bad(set, 'Neveljaven FormData');

    const db = getDb();
    let photoUrl: string | undefined;
    const photoEntry = form.get('photo');
    const photo = photoEntry instanceof File ? photoEntry : null;

    if (photo && photo.size > 0) {
      if (!MIME_EXT[photo.type]) return bad(set, 'Slika mora biti JPEG, WebP ali PNG');
      const filename = `${randomUUID()}${MIME_EXT[photo.type]}`;
      await Bun.write(join(UPLOADS_DIR, filename), photo);
      photoUrl = `/uploads/${filename}`;
    }

    const fields: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') fields[k] = v;
    }

    const parsed = CreateReportFieldsSchema.safeParse(fields);
    if (!parsed.success) return bad(set, 'Validacija ni uspela', parsed.error.errors);

    const { clientId, title, category, description, lat, lng, address } = parsed.data;

    const existing = db
      .prepare('SELECT id, client_id, status, created_at FROM reports WHERE client_id = ?')
      .get(clientId) as Pick<ReportRow, 'id' | 'client_id' | 'status' | 'created_at'> | undefined;
    if (existing) {
      return {
        id: existing.id,
        clientId: existing.client_id,
        status: existing.status,
        createdAt: existing.created_at,
      };
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

    set.status = 201;
    return { id, clientId, status: 'submitted', createdAt: now };
  })

  // ── GET /api/reports ────────────────────────────────────────────────────────
  .get('/api/reports', ({ query, set }) => {
    const parsed = ListQuerySchema.safeParse(query);
    if (!parsed.success) return bad(set, 'Neveljaven query parameter');

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

    return { data: rows.map(rowToReport), total, page, pageSize };
  })

  // ── GET /api/reports/:id ────────────────────────────────────────────────────
  .get('/api/reports/:id', ({ params, set }) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(params.id) as
      | ReportRow
      | undefined;
    if (!row) {
      set.status = 404;
      return { error: 'NotFound', message: 'Prijava ni bila najdena' };
    }
    const history = db
      .prepare('SELECT * FROM status_history WHERE report_id = ? ORDER BY changed_at ASC')
      .all(params.id) as HistoryRow[];
    return { ...rowToReport(row), statusHistory: history.map(rowToHistory) };
  })

  // ── PATCH /api/reports/:id/status ───────────────────────────────────────────
  .patch('/api/reports/:id/status', async ({ params, request, headers, set }) => {
    if (headers['x-admin-token'] !== ADMIN_TOKEN) {
      set.status = 401;
      return { error: 'Unauthorized', message: 'Neveljaven ali manjkajoč admin žeton' };
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!body) return bad(set, 'Neveljaven JSON');

    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) return bad(set, 'Neveljaven body');

    const { status: newStatus, note } = parsed.data;
    const db = getDb();
    const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(params.id) as
      | ReportRow
      | undefined;
    if (!row) {
      set.status = 404;
      return { error: 'NotFound', message: 'Prijava ni bila najdena' };
    }

    if (!(ALLOWED[row.status] ?? []).includes(newStatus)) {
      set.status = 422;
      return {
        error: 'UnprocessableEntity',
        message: `Prehod iz '${row.status}' v '${newStatus}' ni dovoljen`,
      };
    }

    const now = nowTs();
    db.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').run(
      newStatus,
      now,
      params.id,
    );
    db.prepare(
      'INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES (?, ?, ?, ?, ?)',
    ).run(randomUUID(), params.id, newStatus, note ?? null, now);

    const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(params.id) as ReportRow;
    sendStatusChangedPush(db, { reportId: params.id, newStatus, note }).catch(console.error);
    return rowToReport(updated);
  })

  // ── POST /api/subscriptions ─────────────────────────────────────────────────
  .post('/api/subscriptions', async ({ request, set }) => {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!body) return bad(set, 'Neveljaven JSON');

    const parsed = CreateSubscriptionSchema.safeParse(body);
    if (!parsed.success) return bad(set, 'Neveljaven format naročnine');

    const { endpoint, keys } = parsed.data;
    const endpointHash = sha256(endpoint);
    const db = getDb();

    if (db.prepare('SELECT 1 FROM subscriptions WHERE endpoint_hash = ?').get(endpointHash)) {
      return { endpointHash };
    }

    db.prepare(
      'INSERT INTO subscriptions (endpoint_hash, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
    ).run(endpointHash, endpoint, keys.p256dh, keys.auth);

    set.status = 201;
    return { endpointHash };
  })

  // ── DELETE /api/subscriptions/:endpointHash ─────────────────────────────────
  .delete('/api/subscriptions/:endpointHash', ({ params, set }) => {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM subscriptions WHERE endpoint_hash = ?')
      .run(params.endpointHash) as { changes: number };

    if (result.changes === 0) {
      set.status = 404;
      return { error: 'NotFound', message: 'Naročnina ni bila najdena' };
    }
    set.status = 204;
    return null;
  })

  // ── GET /uploads/:filename ──────────────────────────────────────────────────
  .get('/uploads/:filename', ({ params, set }) => {
    const filename = basename(params.filename);
    const filePath = join(UPLOADS_DIR, filename);
    if (!existsSync(filePath)) {
      set.status = 404;
      return 'Not found';
    }
    return new Response(Bun.file(filePath));
  })

  .listen(Number(process.env['PORT'] ?? 3001));

console.warn(`[bun-elysia] Listening on http://localhost:${app.server?.port}`);
