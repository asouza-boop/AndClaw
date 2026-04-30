import { Router, Request, Response } from 'express';
import { query as defaultQuery } from '@/db/postgres';
import { config as defaultConfig } from '@/config/env';
import { issueToken as defaultIssueToken, verifyLoginPassword as defaultVerifyLoginPassword } from '@/server/auth';
import { loadAuthFromDb as defaultLoadAuthFromDb, setSetting as defaultSetSetting } from '@/server/settings';
import { hashPassword as defaultHashPassword, randomSecret as defaultRandomSecret } from '@/server/crypto';
import { sendApiError } from '@/server/http';

export type AuthRouteDeps = {
  query: typeof defaultQuery;
  config: typeof defaultConfig;
  issueToken: typeof defaultIssueToken;
  verifyLoginPassword: typeof defaultVerifyLoginPassword;
  loadAuthFromDb: typeof defaultLoadAuthFromDb;
  setSetting: typeof defaultSetSetting;
  hashPassword: typeof defaultHashPassword;
  randomSecret: typeof defaultRandomSecret;
};

const defaultDeps: AuthRouteDeps = {
  query: defaultQuery,
  config: defaultConfig,
  issueToken: defaultIssueToken,
  verifyLoginPassword: defaultVerifyLoginPassword,
  loadAuthFromDb: defaultLoadAuthFromDb,
  setSetting: defaultSetSetting,
  hashPassword: defaultHashPassword,
  randomSecret: defaultRandomSecret,
};

async function getProfileValues(deps: AuthRouteDeps, userId: string, prefix: string) {
  const rows = await deps.query<{ key: string; value: string }>(
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

async function setProfileValues(deps: AuthRouteDeps, userId: string, prefix: string, values: Record<string, string>) {
  for (const [field, value] of Object.entries(values)) {
    const key = `${prefix}:${userId}:${field}`;
    await deps.query(
      `INSERT INTO user_profile (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );
  }
}

export function createAuthRoutes(overrides: Partial<AuthRouteDeps> = {}) {
  const deps: AuthRouteDeps = { ...defaultDeps, ...overrides };
  const authRoutes = Router();

  authRoutes.post('/auth/login', async (req: Request, res: Response) => {
    const { password } = req.body || {};
    await deps.loadAuthFromDb();
    if (!deps.config.auth.password || !deps.config.auth.tokenSecret) {
      return sendApiError(
        res,
        503,
        'auth_not_configured',
        'Authentication is not configured yet.',
        { retryable: true, retryAfterMs: 30000 }
      );
    }
    if (!password || !deps.verifyLoginPassword(password)) {
      return res.status(401).json({ error: 'invalid password' });
    }
    const token = deps.issueToken('andclaw-user');
    res.json({ token });
  });

  authRoutes.post('/auth/bootstrap', async (req: Request, res: Response) => {
    const { password, tokenSecret } = req.body || {};
    if (!password) return res.status(400).json({ error: 'password required' });

    await deps.loadAuthFromDb();
    if (deps.config.auth.password || deps.config.auth.tokenSecret) {
      return res.status(409).json({ error: 'already_configured' });
    }

    const passwordHash = deps.hashPassword(password);
    const secret = tokenSecret || deps.randomSecret(48);

    await deps.setSetting('auth_password_hash', passwordHash);
    await deps.setSetting('auth_token_secret', secret);

    deps.config.auth.password = passwordHash;
    deps.config.auth.tokenSecret = secret;

    const token = deps.issueToken('andclaw-user');
    res.json({ token });
  });

  authRoutes.get('/auth/me', async (req: Request, res: Response) => {
    const userId = (req as any).user?.sub || 'pwa-user';
    const profile = await getProfileValues(deps, userId, 'profile');
    res.json({
      ok: true,
      id: userId,
      email: profile.email || null,
      fullName: profile.fullName || null,
      name: profile.fullName || null,
      company: profile.company || null,
      role: profile.role || null,
      photoUrl: profile.photoUrl || null,
      profile,
    });
  });

  authRoutes.get('/profile', async (req: Request, res: Response) => {
    const userId = (req as any).user?.sub || 'pwa-user';
    const profile = await getProfileValues(deps, userId, 'profile');
    res.json({ ok: true, profile });
  });

  authRoutes.post('/profile', async (req: Request, res: Response) => {
    const userId = (req as any).user?.sub || 'pwa-user';
    const { fullName = '', email = '', company = '', role = '', photoUrl = '' } = req.body || {};
    await setProfileValues(deps, userId, 'profile', {
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
    const prefs = await getProfileValues(deps, userId, 'pref');
    res.json({ ok: true, preferences: prefs });
  });

  authRoutes.post('/preferences', async (req: Request, res: Response) => {
    const userId = (req as any).user?.sub || 'pwa-user';
    const current = await getProfileValues(deps, userId, 'pref');
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

    await setProfileValues(deps, userId, 'pref', {
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

  return authRoutes;
}

const authRoutes = createAuthRoutes();
export default authRoutes;
