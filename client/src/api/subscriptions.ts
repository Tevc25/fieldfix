const BASE = '/api';

export async function registerPushSubscription(sub: PushSubscription): Promise<string> {
  const json = sub.toJSON();
  const res = await fetch(`${BASE}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.['p256dh'], auth: json.keys?.['auth'] },
    }),
  });
  if (!res.ok) throw new Error(`Failed to register subscription: ${String(res.status)}`);
  const body = (await res.json()) as { endpointHash: string };
  return body.endpointHash;
}

export async function unregisterPushSubscription(endpointHash: string): Promise<void> {
  await fetch(`${BASE}/subscriptions/${encodeURIComponent(endpointHash)}`, {
    method: 'DELETE',
  });
}
