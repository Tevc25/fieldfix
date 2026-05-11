import { openDB, type IDBPDatabase } from 'idb';
import type { ReportCategory } from '@fieldfix/shared';

const DB_NAME = 'fieldfix';
const DB_VERSION = 1;
const STORE_PENDING = 'pending-reports';

export interface PendingReport {
  clientId: string;
  title: string;
  category: ReportCategory;
  description: string;
  lat: number;
  lng: number;
  address?: string;
  photo?: Blob;
  queuedAt: string;
}

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (!_db) {
    _db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_PENDING)) {
          db.createObjectStore(STORE_PENDING, { keyPath: 'clientId' });
        }
      },
    });
  }
  return _db;
}

export async function enqueue(report: PendingReport): Promise<void> {
  const db = await getDb();
  await db.put(STORE_PENDING, report);
}

export async function dequeue(clientId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_PENDING, clientId);
}

export async function getAllPending(): Promise<PendingReport[]> {
  const db = await getDb();
  return db.getAll(STORE_PENDING);
}

export async function getPending(clientId: string): Promise<PendingReport | undefined> {
  const db = await getDb();
  return db.get(STORE_PENDING, clientId);
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_PENDING);
}
