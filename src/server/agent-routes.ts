import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AgentController } from '@/core/AgentController';
import { config as defaultConfig } from '@/config/env';
import { offlineFallbackMessage, hasLLMConfig as defaultHasLLMConfig } from '@/server/llm';
import { AgentRunRequestSchema } from '@/contracts/api';
import { AgentControlState } from '@/contracts/trace';
import { agent } from '@/server/routes/shared';

export type AgentRouteDeps = {
  processInput: (userId: string, input: string, options?: any) => Promise<any>;
  hasLLMConfig: typeof defaultHasLLMConfig;
  offlineFallbackMessage: typeof offlineFallbackMessage;
  getUserId: (req: Request) => string;
  config: typeof defaultConfig;
};

const defaultDeps: AgentRouteDeps = {
  processInput: (userId, input, options) => agent.processInput(userId, input, options),
  hasLLMConfig: defaultHasLLMConfig,
  offlineFallbackMessage,
  getUserId: (req: Request) => (req as any).user?.sub || 'pwa-user',
  config: defaultConfig,
};

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um momento.' },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um momento.' },
});

export function createAgentRoutes(overrides: Partial<AgentRouteDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };
  const router = Router();

  const handler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = AgentRunRequestSchema.parse(req.body || {});
      const userId = deps.getUserId(req);
      const input = parsed.input || parsed.message || '';
      if (!deps.hasLLMConfig()) {
        return res.json({ ok: true, reply: deps.offlineFallbackMessage() });
      }
      const result = await deps.processInput(userId, input, parsed.options);
      
      if (typeof result === 'object' && result !== null && 'reply' in result) {
        return res.json({ ok: true, reply: result.reply, suggestions: result.suggestions, memorable: result.memorable });
      }
      
      return res.json({ ok: true, reply: result });
    } catch (error) {
      return next(error);
    }
  };

  router.post('/ag', generalLimiter, handler);
  router.post('/agent', generalLimiter, handler);
  router.post('/agent/run', strictLimiter, handler);

  router.post('/agent/pause', (req, res) => {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId required' });
    AgentControlState.pause(requestId);
    res.json({ ok: true, paused: true });
  });

  router.post('/agent/resume', (req, res) => {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId required' });
    AgentControlState.resume(requestId);
    res.json({ ok: true, paused: false });
  });

  return router;
}

export default createAgentRoutes();
