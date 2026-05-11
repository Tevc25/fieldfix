import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import type { Database } from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { getDb } from './db.js';
import { initVapid } from './push.js';
import healthRoutes from './routes/health.js';
import reportRoutes from './routes/reports.js';
import subscriptionRoutes from './routes/subscriptions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface BuildServerOptions {
  db?: Database;
  logger?: boolean;
}

export function buildServer(opts: BuildServerOptions = {}) {
  const db = opts.db ?? getDb();
  const logger = opts.logger ?? process.env['NODE_ENV'] !== 'test';

  const fastify = Fastify({ logger });

  // ── Plugins ───────────────────────────────────────────────────────────────
  fastify.register(cors, {
    origin: process.env['NODE_ENV'] === 'production' ? false : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
      files: 1,
      fields: 10,
    },
  });

  const uploadsDir = join(__dirname, '../uploads');
  mkdirSync(uploadsDir, { recursive: true });

  fastify.register(staticPlugin, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  fastify.register(healthRoutes);
  fastify.register(reportRoutes, { db });
  fastify.register(subscriptionRoutes, { db });

  // ── 404 fallback ──────────────────────────────────────────────────────────
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: 'NotFound', message: 'Pot ne obstaja' });
  });

  // ── Error handler ─────────────────────────────────────────────────────────
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    fastify.log.error(error);
    const status = error.statusCode ?? 500;
    reply.status(status).send({
      error: status === 500 ? 'InternalError' : (error.code ?? 'Error'),
      message: status === 500 ? 'Notranja napaka strežnika' : error.message,
    });
  });

  return { fastify, db };
}

export type Server = ReturnType<typeof buildServer>['fastify'];

/** Exposed VAPID public key so the client can subscribe. */
export function getVapidPublicKey(): string {
  const { publicKey } = initVapid();
  return publicKey;
}
