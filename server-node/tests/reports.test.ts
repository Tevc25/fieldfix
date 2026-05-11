import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestServer, ADMIN_TOKEN, MARIBOR_REPORT } from './helpers.js';
import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';

// Build a multipart body from plain fields (no file)
function buildMultipartBody(fields: Record<string, string>): {
  body: Buffer;
  boundary: string;
} {
  const boundary = '----FieldFixTestBoundary';
  const parts = Object.entries(fields).map(
    ([name, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`,
  );
  const body = Buffer.from(`${parts.join('\r\n')}\r\n--${boundary}--\r\n`);
  return { body, boundary };
}

describe('Reports API', () => {
  let fastify: FastifyInstance;
  let db: Database;

  beforeAll(async () => {
    ({ fastify, db } = buildTestServer());
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  // ── POST /api/reports ───────────────────────────────────────────────────

  describe('POST /api/reports', () => {
    it('creates a report and returns 201', async () => {
      const { body, boundary } = buildMultipartBody(MARIBOR_REPORT);
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/reports',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
      expect(res.statusCode).toBe(201);
      const json = res.json<{ id: string; clientId: string; status: string }>();
      expect(json.status).toBe('submitted');
      expect(json.clientId).toBe(MARIBOR_REPORT.clientId);
      expect(typeof json.id).toBe('string');
    });

    it('returns 200 (idempotent) on duplicate clientId', async () => {
      const { body, boundary } = buildMultipartBody(MARIBOR_REPORT);
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/reports',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
      expect(res.statusCode).toBe(200);
    });

    it('returns 400 on missing required fields', async () => {
      const { body, boundary } = buildMultipartBody({
        clientId: '00000000-0000-0000-0000-000000000099',
      });
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/reports',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 on invalid UUID clientId', async () => {
      const { body, boundary } = buildMultipartBody({ ...MARIBOR_REPORT, clientId: 'not-a-uuid' });
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/reports',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /api/reports ────────────────────────────────────────────────────

  describe('GET /api/reports', () => {
    it('returns paginated list', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/reports' });
      expect(res.statusCode).toBe(200);
      const json = res.json<{ data: unknown[]; total: number; page: number; pageSize: number }>();
      expect(Array.isArray(json.data)).toBe(true);
      expect(typeof json.total).toBe('number');
    });

    it('filters by status', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/reports?status=submitted' });
      expect(res.statusCode).toBe(200);
      const json = res.json<{ data: { status: string }[] }>();
      expect(json.data.every((r) => r.status === 'submitted')).toBe(true);
    });

    it('returns 400 for invalid status value', async () => {
      const res = await fastify.inject({ method: 'GET', url: '/api/reports?status=invalid' });
      expect(res.statusCode).toBe(400);
    });

    it('filters by bbox', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/reports?bbox=15.60,46.52,15.70,46.58',
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ── GET /api/reports/:id ────────────────────────────────────────────────

  describe('GET /api/reports/:id', () => {
    let reportId: string;

    beforeAll(() => {
      const row = db.prepare('SELECT id FROM reports LIMIT 1').get() as { id: string } | undefined;
      reportId = row?.id ?? '';
    });

    it('returns full report with statusHistory', async () => {
      if (!reportId) return;
      const res = await fastify.inject({ method: 'GET', url: `/api/reports/${reportId}` });
      expect(res.statusCode).toBe(200);
      const json = res.json<{ id: string; statusHistory: unknown[] }>();
      expect(json.id).toBe(reportId);
      expect(Array.isArray(json.statusHistory)).toBe(true);
    });

    it('returns 404 for unknown id', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/reports/00000000-dead-beef-0000-000000000000',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── PATCH /api/reports/:id/status ──────────────────────────────────────

  describe('PATCH /api/reports/:id/status', () => {
    let submittedId: string;

    beforeAll(async () => {
      // Create a fresh report to transition
      const clientId = '10000000-0000-0000-0000-000000000001';
      const { body, boundary } = buildMultipartBody({ ...MARIBOR_REPORT, clientId });
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/reports',
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
      submittedId = res.json<{ id: string }>().id;
    });

    it('returns 401 without admin token', async () => {
      const res = await fastify.inject({
        method: 'PATCH',
        url: `/api/reports/${submittedId}/status`,
        payload: { status: 'in_review' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('transitions submitted → in_review', async () => {
      const res = await fastify.inject({
        method: 'PATCH',
        url: `/api/reports/${submittedId}/status`,
        headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
        payload: JSON.stringify({ status: 'in_review', note: 'Prevzeto v obravnavo' }),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ status: string }>().status).toBe('in_review');
    });

    it('rejects invalid transition in_review → submitted', async () => {
      const res = await fastify.inject({
        method: 'PATCH',
        url: `/api/reports/${submittedId}/status`,
        headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
        payload: JSON.stringify({ status: 'submitted' }),
      });
      expect(res.statusCode).toBe(422);
    });

    it('transitions in_review → resolved', async () => {
      const res = await fastify.inject({
        method: 'PATCH',
        url: `/api/reports/${submittedId}/status`,
        headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
        payload: JSON.stringify({ status: 'resolved', note: 'Težava odpravljena' }),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ status: string }>().status).toBe('resolved');
    });

    it('rejects further transition from resolved (terminal)', async () => {
      const res = await fastify.inject({
        method: 'PATCH',
        url: `/api/reports/${submittedId}/status`,
        headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
        payload: JSON.stringify({ status: 'in_review' }),
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 404 for unknown report', async () => {
      const res = await fastify.inject({
        method: 'PATCH',
        url: '/api/reports/00000000-dead-0000-0000-000000000000/status',
        headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
        payload: JSON.stringify({ status: 'in_review' }),
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
