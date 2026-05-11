import { Database } from '@db/sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;
const SHARED_DIR = join(__dirname, '../../shared');

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
    const dbPath = Deno.env.get('DB_PATH') ?? join(__dirname, '../fieldfix-deno.db');
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
