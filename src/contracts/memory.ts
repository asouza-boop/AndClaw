import { z } from 'zod';

export const MemoryMetadataSchema = z.record(z.string(), z.any()).default({});

export const MemorySaveSchema = z.object({
  content: z.string().min(1),
  embedding: z.array(z.number().finite()).min(1),
  metadata: MemoryMetadataSchema,
});

export const MemorySearchSchema = z.object({
  embedding: z.array(z.number().finite()).min(1),
  limit: z.number().int().positive().max(20).default(5),
});

export type MemorySaveInput = z.infer<typeof MemorySaveSchema>;
export type MemorySearchInput = z.infer<typeof MemorySearchSchema>;
