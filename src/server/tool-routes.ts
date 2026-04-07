import { Router, Request, Response, NextFunction } from 'express';
import { ToolRegistry } from '@/core/ToolRegistry';
import { ToolInvokeRequestSchema } from '@/contracts/api';
import { ToolExecutionResultSchema } from '@/contracts/tool';
import { z } from 'zod';

export type ToolRouteDeps = {
  registry: ToolRegistry;
};

const defaultDeps: ToolRouteDeps = {
  registry: new ToolRegistry(),
};

function normalizeToolArguments(argumentsValue: unknown): Record<string, unknown> {
  if (argumentsValue && typeof argumentsValue === 'object' && !Array.isArray(argumentsValue)) {
    return argumentsValue as Record<string, unknown>;
  }
  return {};
}

export function createToolRoutes(overrides: Partial<ToolRouteDeps> = {}) {
  const deps = { ...defaultDeps, ...overrides };
  const router = Router();

  router.get('/tools', (_req: Request, res: Response) => {
    const items = deps.registry.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
    res.json({ ok: true, items });
  });

  router.post('/tools/:name', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
      const tool = deps.registry.getTool(name);
      if (!tool) {
        return res.status(404).json({ ok: false, error: 'tool_not_found', message: `Tool '${name}' not found.` });
      }

      const payload = ToolInvokeRequestSchema.parse(req.body || {});
      const normalizedArgs = normalizeToolArguments(payload.arguments || payload.input || payload.args);
      const input = tool.inputSchema
        ? tool.inputSchema.parse(normalizedArgs)
        : z.object({}).passthrough().parse(normalizedArgs);
      const output = await tool.execute(input);
      ToolExecutionResultSchema.parse(output);

      return res.json({ ok: true, output });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export default createToolRoutes();
