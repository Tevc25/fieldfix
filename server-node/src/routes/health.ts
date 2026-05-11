import type { FastifyPluginAsync } from 'fastify';

const startTime = Date.now();

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/health', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      runtime: `node/${process.versions.node}`,
      uptime: (Date.now() - startTime) / 1000,
    });
  });
};

export default healthRoutes;
