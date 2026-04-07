import { Router, Request, Response } from 'express';
import { query } from '../db/postgres';
import { config } from '../config/env';
import { issueToken, verifyLoginPassword } from './auth';
import { loadAuthFromDb, setSetting } from './settings';
import { hashPassword, randomSecret } from './crypto';
import { sendApiError } from './http';

const authRoutes = Router();

async function getProfileValues(userId: string, prefix: string) {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM user_profile WHERE key LIKE $1`,
    [`${prefix}:${userId}:%`]
  );
  return rows.reduce<Record<string, string>>((acc, row) => {
    const parts = row.key.split(':');
    const field = parts[2];
    if (field) acc[field] = row.value;
    return acc;
  }, {});
}

async function setProfileValues(userId: string, prefix: string, values: Record<string, string>) {
  for (const [field, value] of Object.entries(values)) {
    const key = `${prefix}:${userId}:${field}`;
    await query(
      `INSERT INTO user_profile (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );
  }
}

authRoutes.post('/auth/login', async (req: Request, res: Response) => {
  const { password } = req.body || {};
  await loadAuthFromDb();
  if (!config.auth.password || !config.auth.tokenSecret) {
    return sendApiError(
      res,
      503,
      'auth_not_configured',
      'Authentication is not configured yet.',
      { retryable: true, retryAfterMs: 30000 }
    );
  }
  if (!password || !verifyLoginPassword(password)) {
    return res.status(401).json({ error: 'invalid password' });
  }
  const token = issueToken('andclaw-user');
  res.json({ token });
});

authRoutes.post('/auth/bootstrap', async (req: Request, res: Response) => {
  const { password, tokenSecret } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });

  await loadAuthFromDb();
  if (config.auth.password || config.auth.tokenSecret) {
    return res.status(409).json({ error: 'already_configured' });
  }

  const passwordHash = hashPassword(password);
  const secret = tokenSecret || randomSecret(48);

  await setSetting('auth_password_hash', passwordHash);
  await setSetting('auth_token_secret', secret);

  config.auth.password = passwordHash;
  config.auth.tokenSecret = secret;

  const token = issueToken('andclaw-user');
  res.json({ token, tokenSecret: secret });
});

authRoutes.get('/auth/me', async (_req: Request, res: Response) => {
  res.json({ ok: true });
});

authRoutes.get('/profile', async (req: Request, res: Response) => {
  const userId = (req as any).user?.sub || 'pwa-user';
  const profile = await getProfileValues(userId, 'profile');
  res.json({ ok: true, profile });
});

authRoutes.post('/profile', async (req: Request, res: Response) => {
  const userId = (req as any).user?.sub || 'pwa-user';
  const { fullName = '', email = '', company = '', role = '', photoUrl = '' } = req.body || {};
  await setProfileValues(userId, 'profile', {
    fullName: String(fullName),
    email: String(email),
    company: String(company),
    role: String(role),
    photoUrl: String(photoUrl),
  });
  res.json({ ok: true });
});

authRoutes.get('/preferences', async (req: Request, res: Response) => {
  const userId = (req as any).user?.sub || 'pwa-user';
  const prefs = await getProfileValues(userId, 'pref');
  res.json({ ok: true, preferences: prefs });
});

authRoutes.post('/preferences', async (req: Request, res: Response) => {
  const userId = (req as any).user?.sub || 'pwa-user';
  const current = await getProfileValues(userId, 'pref');
  const body = req.body || {};
  const merged = {
    theme: body.theme ?? current.theme ?? 'auto',
    language: body.language ?? current.language ?? 'pt-BR',
    dateFormat: body.dateFormat ?? current.dateFormat ?? 'DD/MM/YYYY',
    notifyEmail: body.notifyEmail ?? current.notifyEmail ?? 'false',
    notifyPush: body.notifyPush ?? current.notifyPush ?? 'false',
    notifyWeekly: body.notifyWeekly ?? current.notifyWeekly ?? 'false',
    notifyAnalysis: body.notifyAnalysis ?? current.notifyAnalysis ?? 'false',
  };

  await setProfileValues(userId, 'pref', {
    theme: String(merged.theme),
    language: String(merged.language),
    dateFormat: String(merged.dateFormat),
    notifyEmail: String(merged.notifyEmail),
    notifyPush: String(merged.notifyPush),
    notifyWeekly: String(merged.notifyWeekly),
    notifyAnalysis: String(merged.notifyAnalysis),
  });

  res.json({ ok: true });
});

export default authRoutes;
