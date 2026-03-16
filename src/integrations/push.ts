import webpush from 'web-push';
import { config } from '../config/env';
import { ensureSchema } from '../db/schema';
import { query } from '../db/postgres';

function ensureVapid() {
  if (!config.push.vapidPublicKey || !config.push.vapidPrivateKey) {
    throw new Error('VAPID keys are not configured.');
  }
  webpush.setVapidDetails(config.push.contactEmail, config.push.vapidPublicKey, config.push.vapidPrivateKey);
}

export function getVapidPublicKey(): string {
  return config.push.vapidPublicKey;
}

export async function registerPushSubscription(subscription: any) {
  ensureVapid();
  await ensureSchema();
  const endpoint = subscription.endpoint;
  const keys = subscription.keys;
  await query(
    `INSERT INTO push_subscriptions (endpoint, keys)
     VALUES ($1, $2)
     ON CONFLICT (endpoint) DO UPDATE SET keys = EXCLUDED.keys`,
    [endpoint, keys]
  );
}

export async function sendPushTest() {
  ensureVapid();
  await ensureSchema();
  const subs = await query<any>(`SELECT * FROM push_subscriptions`);
  const payload = JSON.stringify({ title: 'AndClaw', body: 'Notificação de teste' });

  for (const sub of subs) {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      payload
    );
  }
}

export async function sendDailyTaskAlerts() {
  ensureVapid();
  await ensureSchema();

  const tasks = await query<any>(
    `SELECT * FROM tasks
     WHERE due_date::date = NOW()::date
     ORDER BY due_date ASC`
  );

  if (tasks.length === 0) return;

  const subs = await query<any>(`SELECT * FROM push_subscriptions`);
  const payload = JSON.stringify({
    title: 'AndClaw — tarefas de hoje',
    body: tasks.map(t => t.title).slice(0, 5).join(' • '),
  });

  for (const sub of subs) {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      payload
    );
  }
}
