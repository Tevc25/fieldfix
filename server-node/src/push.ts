import webpush from 'web-push';
import type { Database } from 'better-sqlite3';
import type { ReportStatus } from '@fieldfix/shared';

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  endpoint_hash: string;
}

let vapidInitialized = false;
let _cachedPublicKey = '';
let _cachedPrivateKey = '';

export function initVapid(): { publicKey: string; privateKey: string } {
  if (vapidInitialized) {
    return { publicKey: _cachedPublicKey, privateKey: _cachedPrivateKey };
  }

  let publicKey = process.env['VAPID_PUBLIC_KEY'];
  let privateKey = process.env['VAPID_PRIVATE_KEY'];
  const subject = process.env['VAPID_SUBJECT'] ?? 'mailto:fieldfix@example.com';

  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    // Log to stderr so benchmarks don't capture it
    process.stderr.write(
      '[push] No VAPID keys in env — generated ephemeral keys (set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY for persistence)\n',
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  _cachedPublicKey = publicKey;
  _cachedPrivateKey = privateKey;
  vapidInitialized = true;
  return { publicKey, privateKey };
}

export interface StatusChangedPayload {
  reportId: string;
  newStatus: ReportStatus;
  note?: string;
}

/** Send push notification to every registered subscription. Stale endpoints (410) are pruned. */
export async function sendStatusChangedPush(
  db: Database,
  payload: StatusChangedPayload,
): Promise<void> {
  const rows = db
    .prepare('SELECT endpoint_hash, endpoint, p256dh, auth FROM subscriptions')
    .all() as SubscriptionRow[];

  const body = JSON.stringify({
    type: 'status_changed',
    ...payload,
  });

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
        // 410 Gone = subscription expired; remove it
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
    const deleteMany = db.transaction((hashes: string[]) => {
      for (const h of hashes) del.run(h);
    });
    deleteMany(toDelete);
  }
}
