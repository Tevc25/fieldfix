import { buildServer, getVapidPublicKey } from './server.js';
import { initVapid } from './push.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

const { fastify } = buildServer({ logger: true });

// Expose VAPID public key — client needs this to subscribe
fastify.get('/api/vapid-public-key', async (_req, reply) => {
  return reply.send({ publicKey: getVapidPublicKey() });
});

try {
  initVapid();
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`FieldFix server-node listening on ${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
