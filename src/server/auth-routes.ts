import { Router, Request, Response } from 'express';
import { query as defaultQuery } from '@/db/postgres';
import { config as defaultConfig } from '@/config/env';
import { issueToken as defaultIssueToken, verifyLoginPassword as defaultVerifyLoginPassword } from '@/server/auth';
import { loadAuthFromDb as defaultLoadAuthFromDb, setSetting as defaultSetSetting } from '@/server/settings';
import { hashPassword as defaultHashPassword, randomSecret as defaultRandomSecret } from '@/server/crypto';
import { sendApiError } from '@/server/http';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '@/infra/logger';

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

function getAllowedFrontendOrigins(deps: AuthRouteDeps) {
  return new Set(
    [
      deps.config.server.frontendUrl,
      ...deps.config.server.allowedOrigin.split(','),
      'https://and-claw.vercel.app',
      'https://andclaw-command-ui.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
    ]
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean)
  );
}

function getReturnToFromState(state: string): string | null {
  const encoded = state.split('.')[1];
  if (!encoded) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    return typeof parsed.returnTo === 'string' ? parsed.returnTo.replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

function getFrontendUrl(deps: AuthRouteDeps, state = '') {
  const stateReturnTo = getReturnToFromState(state);
  const allowedOrigins = getAllowedFrontendOrigins(deps);
  if (stateReturnTo && allowedOrigins.has(stateReturnTo)) {
    return stateReturnTo;
  }

  return (deps.config.server.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
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

  authRoutes.get('/auth/google', async (req: Request, res: Response) => {
    if (!deps.config.google.oauthClientId || !deps.config.google.oauthClientSecret) {
      return res.status(503).json({ error: 'Google OAuth not configured' });
    }
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;

    const oAuth2Client = new OAuth2Client(
      deps.config.google.oauthClientId,
      deps.config.google.oauthClientSecret,
      deps.config.google.oauthRedirectUri || `${req.protocol}://${req.get('host')}/api/auth/google/callback`
    );

    const authorizeUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
      prompt: 'consent',
      state
    });

    res.redirect(authorizeUrl);
  });

  authRoutes.get('/auth/google/callback', async (req: Request, res: Response) => {
    const { code } = req.query;
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const frontendUrl = getFrontendUrl(deps, state);
    
    if (!code || typeof code !== 'string') {
      return res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }

    try {
      const oAuth2Client = new OAuth2Client(
        deps.config.google.oauthClientId,
        deps.config.google.oauthClientSecret,
        deps.config.google.oauthRedirectUri || `${req.protocol}://${req.get('host')}/api/auth/google/callback`
      );

      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      const ticket = await oAuth2Client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: deps.config.google.oauthClientId,
      });

      const payload = ticket.getPayload();
      const email = payload?.email?.toLowerCase();

      if (!email) {
        return res.redirect(`${frontendUrl}/login?error=auth_failed`);
      }

      // Check allowed emails
      if (deps.config.auth.allowedEmails.length > 0 && !deps.config.auth.allowedEmails.includes(email)) {
        logger.warn(`[AUTH] Blocked unauthorized login attempt from: ${email}`);
        return res.redirect(`${frontendUrl}/login?error=auth_failed`);
      }

      // Automatically configure system if first time
      await deps.loadAuthFromDb();
      if (!deps.config.auth.tokenSecret) {
        const secret = deps.randomSecret(48);
        await deps.setSetting('auth_token_secret', secret);
        deps.config.auth.tokenSecret = secret;
      }

      // Issue token
      // We can use the email as subject to track who is who
      const jwt = deps.issueToken(email);
      
      // Update profile from google
      await setProfileValues(deps, email, 'profile', {
        fullName: payload?.name || '',
        email: payload?.email || '',
        photoUrl: payload?.picture || '',
      });

      // Redirect to frontend callback route to store token
      res.redirect(`${frontendUrl}/auth/callback?token=${encodeURIComponent(jwt)}&state=${encodeURIComponent(state)}`);
    } catch (error) {
      logger.error('auth.google_callback_failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
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
