import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestServer } from './helpers.js';
import type { FastifyInstance } from 'fastify';

describe('GET /api/health', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    ({ fastify } = buildTestServer());
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('returns 200 with status ok', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; runtime: string; uptime: number }>();
    expect(body.status).toBe('ok');
    expect(body.runtime).toMatch(/^node\//);
    expect(typeof body.uptime).toBe('number');
  });
});
