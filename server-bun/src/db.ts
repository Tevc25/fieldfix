import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SHARED_DIR = join(import.meta.dir, '../../shared');

export function createDb(dbPath = ':memory:'): Database {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.exec(readFileSync(join(SHARED_DIR, 'schema.sql'), 'utf8'));
  return db;
}

export function seedDb(db: Database): void {
  db.exec(readFileSync(join(SHARED_DIR, 'seed.sql'), 'utf8'));
}

let _singleton: Database | null = null;

export function getDb(): Database {
  if (!_singleton) {
    const dbPath = process.env['DB_PATH'] ?? join(import.meta.dir, '../fieldfix-bun.db');
    _singleton = createDb(dbPath);
    const count = (_singleton.prepare('SELECT COUNT(*) as n FROM reports').get() as { n: number })
      .n;
    if (count === 0 && existsSync(join(SHARED_DIR, 'seed.sql'))) {
      seedDb(_singleton);
    }
  }
  return _singleton;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
