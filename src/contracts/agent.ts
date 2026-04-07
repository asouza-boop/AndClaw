import { z } from 'zod';

export const AgentHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
});

export const AgentOptionsSchema = z.object({
  userId: z.string().min(1).optional(),
  audioData: z.string().optional(),
  mimeType: z.string().optional(),
  memoryLimit: z.number().int().positive().max(20).optional(),
}).passthrough();

export const AgentRunInputSchema = z.object({
  systemPrompt: z.string().min(1),
  history: z.array(AgentHistoryItemSchema),
  userInput: z.string().min(1),
  options: AgentOptionsSchema.default({}),
});

export type AgentHistoryItem = z.infer<typeof AgentHistoryItemSchema>;
export type AgentOptions = z.infer<typeof AgentOptionsSchema>;
export type AgentRunInput = z.infer<typeof AgentRunInputSchema>;
