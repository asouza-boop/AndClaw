import { z } from 'zod';

export const AgentRunRequestSchema = z.object({
  input: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  options: z.record(z.string(), z.any()).default({}),
}).refine((value) => Boolean(value.input || value.message), {
  message: 'input is required',
  path: ['input'],
});

export const MemoryUpsertRequestSchema = z.object({
  type: z.string().min(1),
  content: z.string().min(1),
  source_type: z.string().optional(),
  source_id: z.string().optional(),
});

export const ToolInvokeRequestSchema = z.object({
  arguments: z.record(z.string(), z.any()).optional(),
  input: z.record(z.string(), z.any()).optional(),
  args: z.record(z.string(), z.any()).optional(),
}).passthrough();

