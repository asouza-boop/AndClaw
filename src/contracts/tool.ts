import { z } from 'zod';

export const ToolCallArgumentsSchema = z.union([
  z.object({}).passthrough(),
  z.string(),
  z.null(),
  z.undefined(),
]);

export const ToolExecutionResultSchema = z.union([
  z.string(),
  z.object({
    ok: z.boolean(),
    output: z.string().optional(),
    error: z.string().optional(),
  }).passthrough(),
]);

export const ToolInputSchema = z.object({
  name: z.string().min(1),
  arguments: ToolCallArgumentsSchema,
});

export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;
