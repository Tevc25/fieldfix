import { createDb } from '../src/db.js';
import { buildServer } from '../src/server.js';

export function buildTestServer() {
  const db = createDb(':memory:');
  const { fastify } = buildServer({ db, logger: false });
  return { fastify, db };
}

export const ADMIN_TOKEN = 'dev-admin-token-fieldfix';

export const MARIBOR_REPORT = {
  clientId: '00000000-0000-0000-0000-000000000001',
  title: 'Udarna jama na testni ulici',
  category: 'pothole',
  description: 'Testna udarna jama, ki je zelo nevarna za kolesarje in pešce.',
  lat: '46.5583',
  lng: '15.6459',
  address: 'Testna ulica 1, 2000 Maribor',
};
