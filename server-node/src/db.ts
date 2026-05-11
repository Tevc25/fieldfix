import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_DIR = join(__dirname, '../../shared');

export function createDb(dbPath = ':memory:'): Database.Database {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  const schema = readFileSync(join(SHARED_DIR, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

export function seedDb(db: Database.Database): void {
  const seed = readFileSync(join(SHARED_DIR, 'seed.sql'), 'utf8');
  db.exec(seed);
}

let _singleton: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_singleton) {
    const dbPath = process.env['DB_PATH'] ?? join(__dirname, '../fieldfix.db');
    _singleton = createDb(dbPath);

    // Auto-seed when DB is empty (fresh start)
    const count = (_singleton.prepare('SELECT COUNT(*) as n FROM reports').get() as { n: number })
      .n;
    if (count === 0 && existsSync(join(SHARED_DIR, 'seed.sql'))) {
      seedDb(_singleton);
    }
  }
  return _singleton;
}

/** SHA-256 hex digest of a string (used for subscription endpoint hashes). */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
