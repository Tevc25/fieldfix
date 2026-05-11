import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { enqueue, dequeue, getAllPending, countPending, getPending } from '../../src/db/queue.ts';
import type { PendingReport } from '../../src/db/queue.ts';

function makeReport(clientId: string): PendingReport {
  return {
    clientId,
    title: 'Test prijava',
    category: 'pothole',
    description: 'Testni opis udarne jame na testni ulici.',
    lat: 46.558,
    lng: 15.646,
    queuedAt: new Date().toISOString(),
  };
}

describe('IndexedDB queue', () => {
  it('enqueue adds a report', async () => {
    const r = makeReport('q-test-001');
    await enqueue(r);
    const found = await getPending('q-test-001');
    expect(found).toBeDefined();
    expect(found?.title).toBe(r.title);
  });

  it('enqueue is idempotent (put overwrites same clientId)', async () => {
    const r = makeReport('q-test-002');
    await enqueue(r);
    await enqueue({ ...r, title: 'Updated' });
    const found = await getPending('q-test-002');
    expect(found?.title).toBe('Updated');
    expect(await countPending()).toBeGreaterThanOrEqual(1);
  });

  it('dequeue removes an existing report', async () => {
    const r = makeReport('q-test-003');
    await enqueue(r);
    await dequeue('q-test-003');
    const found = await getPending('q-test-003');
    expect(found).toBeUndefined();
  });

  it('dequeue on missing key does not throw', async () => {
    await expect(dequeue('nonexistent-id')).resolves.toBeUndefined();
  });

  it('getAllPending returns all enqueued reports', async () => {
    const ids = ['q-test-010', 'q-test-011', 'q-test-012'];
    for (const id of ids) await enqueue(makeReport(id));
    const all = await getAllPending();
    const allIds = all.map((r) => r.clientId);
    for (const id of ids) expect(allIds).toContain(id);
  });

  it('countPending reflects enqueue and dequeue', async () => {
    const before = await countPending();
    await enqueue(makeReport('q-test-020'));
    expect(await countPending()).toBe(before + 1);
    await dequeue('q-test-020');
    expect(await countPending()).toBe(before);
  });
});
