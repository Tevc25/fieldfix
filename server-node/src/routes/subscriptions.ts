import type { FastifyPluginAsync } from 'fastify';
import type { Database } from 'better-sqlite3';
import { sha256 } from '../db.js';
import { CreateSubscriptionSchema } from '../schemas/subscriptions.js';

interface SubscriptionRow {
  endpoint_hash: string;
}

const subscriptionRoutes: FastifyPluginAsync<{ db: Database }> = async (fastify, opts) => {
  const db = opts.db;

  // POST /api/subscriptions — register a push subscription
  fastify.post('/api/subscriptions', async (request, reply) => {
    const parsed = CreateSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Neveljaven format naročnine',
        details: parsed.error.errors,
      });
    }

    const { endpoint, keys } = parsed.data;
    const endpointHash = sha256(endpoint);

    const existing = db
      .prepare('SELECT endpoint_hash FROM subscriptions WHERE endpoint_hash = ?')
      .get(endpointHash) as SubscriptionRow | undefined;

    if (existing) {
      return reply.status(200).send({ endpointHash });
    }

    db.prepare(
      'INSERT INTO subscriptions (endpoint_hash, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
    ).run(endpointHash, endpoint, keys.p256dh, keys.auth);

    return reply.status(201).send({ endpointHash });
  });

  // DELETE /api/subscriptions/:endpointHash — unsubscribe
  fastify.delete<{ Params: { endpointHash: string } }>(
    '/api/subscriptions/:endpointHash',
    async (request, reply) => {
      const { endpointHash } = request.params;

      const result = db
        .prepare('DELETE FROM subscriptions WHERE endpoint_hash = ?')
        .run(endpointHash);

      if (result.changes === 0) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'Naročnina ni bila najdena',
        });
      }

      return reply.status(204).send();
    },
  );
};

export default subscriptionRoutes;
