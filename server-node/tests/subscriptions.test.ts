import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestServer } from './helpers.js';
import type { FastifyInstance } from 'fastify';

const FAKE_SUBSCRIPTION = {
  endpoint: 'https://push.example.com/sub/test-endpoint-abc123',
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtjKbDifJiX2VSNgiv0sUos4GR9Q2GCdk',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
};

describe('Subscriptions API', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    ({ fastify } = buildTestServer());
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  let endpointHash: string;

  it('POST /api/subscriptions returns 201 and endpointHash', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(FAKE_SUBSCRIPTION),
    });
    expect(res.statusCode).toBe(201);
    const json = res.json<{ endpointHash: string }>();
    expect(typeof json.endpointHash).toBe('string');
    expect(json.endpointHash.length).toBe(64); // SHA-256 hex
    endpointHash = json.endpointHash;
  });

  it('POST /api/subscriptions is idempotent (returns 200 on duplicate)', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(FAKE_SUBSCRIPTION),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ endpointHash: string }>().endpointHash).toBe(endpointHash);
  });

  it('POST /api/subscriptions returns 400 on missing keys', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ endpoint: 'https://push.example.com/test' }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE /api/subscriptions/:hash returns 204', async () => {
    const res = await fastify.inject({
      method: 'DELETE',
      url: `/api/subscriptions/${endpointHash}`,
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE /api/subscriptions/:hash returns 404 when already deleted', async () => {
    const res = await fastify.inject({
      method: 'DELETE',
      url: `/api/subscriptions/${endpointHash}`,
    });
    expect(res.statusCode).toBe(404);
  });
});
