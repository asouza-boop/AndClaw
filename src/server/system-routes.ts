import { Router, Request, Response } from 'express';
import { config } from '@/config/env';
import { ensureSchema } from '@/db/schema';
import { loadAppSettings } from '@/server/settings';
import { query } from '@/db/postgres';
import { getRequestId, sendApiError, setRetryHeaders } from '@/server/http';

const systemRoutes = Router();

async function collectRuntimeStatus() {
  const bootstrapped = Boolean(config.auth.password && config.auth.tokenSecret);
  const db = { ok: false, latencyMs: null as number | null, error: '' };
  try {
    await ensureSchema();
    const start = Date.now();
    await query('SELECT 1 as ok');
    db.ok = true;
    db.latencyMs = Date.now() - start;
  } catch (error: any) {
    db.error = error?.message || 'database_unavailable';
  }

  const settings = db.ok ? await loadAppSettings() : {};
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
      configured: Boolean(config.auth.password && config.auth.tokenSecret),
    },
    settings,
    llm: {
      configured: Boolean(config.llm.geminiKey || config.llm.deepseekKey || config.llm.openrouterKey),
      defaultProvider: config.llm.defaultProvider,
    },
  };
}

systemRoutes.get('/health', async (_req: Request, res: Response) => {
  setRetryHeaders(res, false);
  res.json({ ok: true, status: 'healthy', requestId: getRequestId(res) });
});

systemRoutes.get('/health/db', async (_req: Request, res: Response) => {
  const runtime = await collectRuntimeStatus();
  setRetryHeaders(res, !runtime.db.ok, runtime.db.ok ? 0 : 30000);
  if (!runtime.db.ok) {
    return sendApiError(res, 503, 'db_unavailable', 'Database is not reachable.', {
      retryable: true,
      retryAfterMs: 30000,
      requestId: getRequestId(res),
      db: runtime.db,
    });
  }
  res.json({ ok: true, status: 'ready', requestId: getRequestId(res), db: runtime.db });
});

systemRoutes.get('/health/runtime', async (_req: Request, res: Response) => {
  const runtime = await collectRuntimeStatus();
  setRetryHeaders(res, runtime.retryable, runtime.retryAfterMs);
  if (!runtime.ready) {
    return sendApiError(res, 503, 'runtime_not_ready', 'Runtime is not ready yet.', {
      retryable: true,
      retryAfterMs: runtime.retryAfterMs,
      extra: runtime,
    });
  }
  res.json({ ...runtime, requestId: getRequestId(res) });
});

systemRoutes.get('/status', async (_req: Request, res: Response) => {
  const runtime = await collectRuntimeStatus();
  if (!runtime.ready) {
    return sendApiError(res, 503, 'runtime_not_ready', 'Runtime is not ready yet.', {
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
        configured: Boolean(config.google.oauthClientId && config.google.oauthClientSecret),
        exportCalendarId: config.google.exportCalendarId,
      },
      gitvault: {
        configured: Boolean(config.gitvault.repo && config.gitvault.token),
        basePath: config.gitvault.basePath,
      },
      push: {
        configured: Boolean(config.push.vapidPublicKey && config.push.vapidPrivateKey),
      },
      raindrop: {
        configured: Boolean(config.raindrop.token),
      },
    },
    settings,
    requestId: getRequestId(res),
  };

  res.json(status);
});

export default systemRoutes;
