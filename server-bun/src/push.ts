import webpush from 'web-push';
import type { Database } from 'bun:sqlite';
import type { ReportStatus } from '@fieldfix/shared';

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  endpoint_hash: string;
}

let vapidInitialized = false;

export function initVapid(): { publicKey: string; privateKey: string } {
  if (vapidInitialized) {
    return {
      publicKey: process.env['VAPID_PUBLIC_KEY'] ?? '',
      privateKey: process.env['VAPID_PRIVATE_KEY'] ?? '',
    };
  }

  let publicKey = process.env['VAPID_PUBLIC_KEY'];
  let privateKey = process.env['VAPID_PRIVATE_KEY'];
  const subject = process.env['VAPID_SUBJECT'] ?? 'mailto:fieldfix@example.com';

  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    process.stderr.write('[push] No VAPID keys — generated ephemeral keys\n');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
  return { publicKey, privateKey };
}

export interface StatusChangedPayload {
  reportId: string;
  newStatus: ReportStatus;
  note?: string;
}

export async function sendStatusChangedPush(
  db: Database,
  payload: StatusChangedPayload,
): Promise<void> {
  const rows = db
    .prepare('SELECT endpoint_hash, endpoint, p256dh, auth FROM subscriptions')
    .all() as SubscriptionRow[];

  const body = JSON.stringify({ type: 'status_changed', ...payload });
  const toDelete: string[] = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
          { TTL: 86400 },
        );
      } catch (err) {
        if (
          err instanceof Error &&
          'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 410
        ) {
          toDelete.push(row.endpoint_hash);
        }
      }
    }),
  );

  if (toDelete.length > 0) {
    const del = db.prepare('DELETE FROM subscriptions WHERE endpoint_hash = ?');
    for (const h of toDelete) del.run(h);
  }
}
