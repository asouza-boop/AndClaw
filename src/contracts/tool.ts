import { z } from 'zod';

export const ToolCategorySchema = z.enum(['system', 'integration', 'cognitive']);

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

export const ToolMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: ToolCategorySchema,
  parameters: z.any(),
});

export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;
export type ToolCategory = z.infer<typeof ToolCategorySchema>;
export type ToolMetadata = z.infer<typeof ToolMetadataSchema>;
