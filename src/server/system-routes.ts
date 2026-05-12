import { Router, Request, Response } from 'express';
import { config as defaultConfig } from '@/config/env';
import { ensureSchema as defaultEnsureSchema } from '@/db/schema';
import { loadAppSettings as defaultLoadAppSettings } from '@/server/settings';
import { query as defaultQuery } from '@/db/postgres';
import { getRequestId as defaultGetRequestId, sendApiError as defaultSendApiError, setRetryHeaders as defaultSetRetryHeaders } from '@/server/http';

export type SystemRouteDeps = {
  config: typeof defaultConfig;
  ensureSchema: typeof defaultEnsureSchema;
  loadAppSettings: typeof defaultLoadAppSettings;
  query: typeof defaultQuery;
  getRequestId: typeof defaultGetRequestId;
  sendApiError: typeof defaultSendApiError;
  setRetryHeaders: typeof defaultSetRetryHeaders;
};

const defaultDeps: SystemRouteDeps = {
  config: defaultConfig,
  ensureSchema: defaultEnsureSchema,
  loadAppSettings: defaultLoadAppSettings,
  query: defaultQuery,
  getRequestId: defaultGetRequestId,
  sendApiError: defaultSendApiError,
  setRetryHeaders: defaultSetRetryHeaders,
};

async function collectRuntimeStatus(deps: SystemRouteDeps) {
  const bootstrapped = Boolean(deps.config.auth.tokenSecret);
  const db = { ok: false, latencyMs: null as number | null, error: '' };
  try {
    await deps.ensureSchema();
    const start = Date.now();
    await deps.query('SELECT 1 as ok');
    db.ok = true;
    db.latencyMs = Date.now() - start;
  } catch (error: any) {
    db.error = error?.message || 'database_unavailable';
  }

  const settings = db.ok ? await deps.loadAppSettings() : {};
  const ready = bootstrapped && db.ok;
  const retryable = !ready;
  const retryAfterMs = ready ? 0 : 30000;
  return {
    ok: ready,
    ready,
    retryable,
    retryAfterMs,
    db,
    auth: {
      bootstrapped,
      configured: Boolean(deps.config.auth.tokenSecret),
    },
    settings,
    llm: {
      configured: Boolean(deps.config.llm.geminiKey || deps.config.llm.deepseekKey || deps.config.llm.openrouterKey),
      defaultProvider: deps.config.llm.defaultProvider,
    },
  };
}

export function createSystemRoutes(overrides: Partial<SystemRouteDeps> = {}) {
  const deps: SystemRouteDeps = { ...defaultDeps, ...overrides };
  const systemRoutes = Router();

  systemRoutes.get('/health', async (_req: Request, res: Response) => {
    deps.setRetryHeaders(res, false);
    res.json({ ok: true, status: 'healthy', requestId: deps.getRequestId(res) });
  });

  systemRoutes.get('/health/db', async (_req: Request, res: Response) => {
    const runtime = await collectRuntimeStatus(deps);
    deps.setRetryHeaders(res, !runtime.db.ok, runtime.db.ok ? 0 : 30000);
    if (!runtime.db.ok) {
      return deps.sendApiError(res, 503, 'db_unavailable', 'Database is not reachable.', {
        retryable: true,
        retryAfterMs: 30000,
        requestId: deps.getRequestId(res),
        db: runtime.db,
      });
    }
    res.json({ ok: true, status: 'ready', requestId: deps.getRequestId(res), db: runtime.db });
  });

  systemRoutes.get('/health/runtime', async (_req: Request, res: Response) => {
    const runtime = await collectRuntimeStatus(deps);
    deps.setRetryHeaders(res, runtime.retryable, runtime.retryAfterMs);
    if (!runtime.ready) {
      return deps.sendApiError(res, 503, 'runtime_not_ready', 'Runtime is not ready yet.', {
        retryable: true,
        retryAfterMs: runtime.retryAfterMs,
        extra: runtime,
      });
    }
    res.json({ ...runtime, requestId: deps.getRequestId(res) });
  });

  systemRoutes.get('/status', async (_req: Request, res: Response) => {
    const runtime = await collectRuntimeStatus(deps);
    if (!runtime.ready) {
      return deps.sendApiError(res, 503, 'runtime_not_ready', 'Runtime is not ready yet.', {
        retryable: true,
        retryAfterMs: runtime.retryAfterMs,
        runtime,
      });
    }

    const settings = runtime.settings;
    const status = {
      ok: true,
      ready: runtime.ready,
      db: runtime.db,
      auth: runtime.auth,
      llm: runtime.llm,
      integrations: {
        google: {
          configured: Boolean(deps.config.google.oauthClientId && deps.config.google.oauthClientSecret),
          exportCalendarId: deps.config.google.exportCalendarId,
        },
        gitvault: {
          configured: Boolean(deps.config.gitvault.repo && deps.config.gitvault.token),
          basePath: deps.config.gitvault.basePath,
        },
        push: {
          configured: Boolean(deps.config.push.vapidPublicKey && deps.config.push.vapidPrivateKey),
        },
        raindrop: {
          configured: Boolean(deps.config.raindrop.token),
        },
      },
      settings,
      requestId: deps.getRequestId(res),
    };

    res.json(status);
  });

  return systemRoutes;
}

const systemRoutes = createSystemRoutes();
export default systemRoutes;
