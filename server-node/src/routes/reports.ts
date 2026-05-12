import type { FastifyPluginAsync } from 'fastify';
import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { ReportStatus, ReportCategory } from '@fieldfix/shared';
import {
  CreateReportFieldsSchema,
  ListQuerySchema,
  UpdateStatusSchema,
  isValidTransition,
} from '../schemas/reports.js';
import { sendStatusChangedPush } from '../push.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '../../uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

const ADMIN_TOKEN = process.env['ADMIN_TOKEN'] ?? 'dev-admin-token-fieldfix';

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

function rowToReport(row: ReportRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    category: row.category,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    address: row.address ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHistoryEntry(row: HistoryRow) {
  return {
    id: row.id,
    reportId: row.report_id,
    status: row.status,
    note: row.note ?? undefined,
    changedAt: row.changed_at,
  };
}

const reportRoutes: FastifyPluginAsync<{ db: Database }> = async (fastify, opts) => {
  const db = opts.db;

  // ── POST /api/reports ─────────────────────────────────────────────────────
  fastify.post('/api/reports', async (request, reply) => {
    const fields: Record<string, string> = {};
    let photoUrl: string | undefined;

    // Consume multipart stream
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'photo') {
        const allowed = ['image/jpeg', 'image/webp', 'image/png'];
        if (!allowed.includes(part.mimetype)) {
          // Drain the stream to avoid memory leak
          part.file.resume();
          return reply.status(400).send({
            error: 'BadRequest',
            message: 'Slika mora biti JPEG, WebP ali PNG',
          });
        }
        const ext = extname(part.filename || '.jpg') || '.jpg';
        const filename = `${randomUUID()}${ext}`;
        const filePath = join(UPLOADS_DIR, filename);
        await pipeline(part.file, createWriteStream(filePath));
        photoUrl = `/uploads/${filename}`;
      } else if (part.type === 'field') {
        fields[part.fieldname] = part.value as string;
      }
    }

    const parsed = CreateReportFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Validacija ni uspela',
        details: parsed.error.errors,
      });
    }

    const { clientId, title, category, description, lat, lng, address } = parsed.data;

    // Idempotent: if clientId already exists, return the existing report
    const existing = db
      .prepare('SELECT id, client_id, status, created_at FROM reports WHERE client_id = ?')
      .get(clientId) as Pick<ReportRow, 'id' | 'client_id' | 'status' | 'created_at'> | undefined;

    if (existing) {
      return reply.status(200).send({
        id: existing.id,
        clientId: existing.client_id,
        status: existing.status,
        createdAt: existing.created_at,
      });
    }

    const id = randomUUID();
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    db.prepare(
      `INSERT INTO reports (id, client_id, title, category, description, lat, lng, address, photo_url, status, created_at, updated_at)
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

    return reply.status(201).send({ id, clientId, status: 'submitted', createdAt: now });
  });

  // ── GET /api/reports ──────────────────────────────────────────────────────
  fastify.get('/api/reports', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Neveljaven query parameter',
        details: parsed.error.errors,
      });
    }

    const { status, bbox, page, pageSize } = parsed.data;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
      conditions.push('lng BETWEEN ? AND ? AND lat BETWEEN ? AND ?');
      params.push(minLng, maxLng, minLat, maxLat);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (
      db.prepare(`SELECT COUNT(*) as n FROM reports ${where}`).get(...params) as { n: number }
    ).n;

    const rows = db
      .prepare(`SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset) as ReportRow[];

    return reply.status(200).send({
      data: rows.map(rowToReport),
      total,
      page,
      pageSize,
    });
  });

  // ── GET /api/reports/:id ──────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/api/reports/:id', async (request, reply) => {
    const { id } = request.params;

    const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
    if (!row) {
      return reply.status(404).send({ error: 'NotFound', message: 'Prijava ni bila najdena' });
    }

    const history = db
      .prepare('SELECT * FROM status_history WHERE report_id = ? ORDER BY changed_at ASC')
      .all(id) as HistoryRow[];

    return reply.status(200).send({
      ...rowToReport(row),
      statusHistory: history.map(rowToHistoryEntry),
    });
  });

  // ── PATCH /api/reports/:id/status ─────────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>('/api/reports/:id/status', async (request, reply) => {
    // Admin auth
    const token = request.headers['x-admin-token'];
    if (token !== ADMIN_TOKEN) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Neveljaven ali manjkajoč admin žeton',
      });
    }

    const parsed = UpdateStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Neveljaven body',
        details: parsed.error.errors,
      });
    }

    const { id } = request.params;
    const { status: newStatus, note } = parsed.data;

    const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
    if (!row) {
      return reply.status(404).send({ error: 'NotFound', message: 'Prijava ni bila najdena' });
    }

    if (!isValidTransition(row.status, newStatus)) {
      return reply.status(422).send({
        error: 'UnprocessableEntity',
        message: `Prehod iz '${row.status}' v '${newStatus}' ni dovoljen`,
      });
    }

    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    db.prepare('UPDATE reports SET status = ?, updated_at = ? WHERE id = ?').run(
      newStatus,
      now,
      id,
    );
    db.prepare(
      'INSERT INTO status_history (id, report_id, status, note, changed_at) VALUES (?, ?, ?, ?, ?)',
    ).run(randomUUID(), id, newStatus, note ?? null, now);

    const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow;

    // Fire-and-forget push; don't block the response
    sendStatusChangedPush(db, { reportId: id, newStatus, note }).catch((err: unknown) => {
      fastify.log.error({ err }, 'push failed');
    });

    return reply.status(200).send(rowToReport(updated));
  });

  // ── DELETE /api/reports/:id ───────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/api/reports/:id', async (request, reply) => {
    const token = request.headers['x-admin-token'];
    if (token !== ADMIN_TOKEN) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Neveljaven ali manjkajoč admin žeton',
      });
    }

    const { id } = request.params;
    const row = db.prepare('SELECT id FROM reports WHERE id = ?').get(id);
    if (!row) {
      return reply.status(404).send({ error: 'NotFound', message: 'Prijava ni bila najdena' });
    }

    db.prepare('DELETE FROM status_history WHERE report_id = ?').run(id);
    db.prepare('DELETE FROM reports WHERE id = ?').run(id);

    return reply.status(204).send();
  });
};

export default reportRoutes;
