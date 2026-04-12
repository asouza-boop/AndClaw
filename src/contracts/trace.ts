import { z } from 'zod';

export const TraceStepSchema = z.object({
  type: z.string(),
  timestamp: z.string(),
  status: z.enum(['start', 'end', 'success', 'failure', 'blocked', 'hit', 'miss', 'pending']),
  data: z.record(z.string(), z.any()).optional(),
});

export const ExecutionTraceSchema = z.object({
  version: z.literal('v1'),
  steps: z.array(TraceStepSchema),
});

export type TraceStep = z.infer<typeof TraceStepSchema>;
export type ExecutionTrace = z.infer<typeof ExecutionTraceSchema>;

/**
 * Singleton for lightweight execution control.
 * Allows signaling 'pause' from outside the loop (API calls).
 */
export class AgentControlState {
  private static pausedRequests = new Set<string>();

  public static pause(requestId: string) {
    this.pausedRequests.add(requestId);
  }

  public static resume(requestId: string) {
    this.pausedRequests.delete(requestId);
  }

  public static isPaused(requestId: string): boolean {
    return this.pausedRequests.has(requestId);
  }
}
