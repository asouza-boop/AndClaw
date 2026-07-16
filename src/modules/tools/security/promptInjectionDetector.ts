import { logger } from '@/infra/logger';
export class PromptInjectionDetector {
  private static readonly INJECTION_PATTERNS = [
    /ignore (all )?previous instructions/i,
    /bypass (the )?system/i,
    /execute arbitrary code/i,
    /drop table/i,
    /system prompt/i,
    /disregard (all )?previous/i,
    /you are now a/i,
    /forget everything/i
  ];

  public static analyze(input: string): { isSafe: boolean; reason?: string } {
    if (!input || typeof input !== 'string') {
      return { isSafe: true };
    }

    const normalizedInput = input.toLowerCase();

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(normalizedInput)) {
        logger.info(`[Observability] security.scan.result: Failed (Prompt Injection)`);
        logger.warn(`[Observability] security.blocked: Execution blocked due to suspicious prompt injection pattern matching ${pattern.toString()}`);
        return { isSafe: false, reason: 'Suspicious prompt injection phrase detected' };
      }
    }

    // logger.info(`[Observability] security.scan.result: Passed (Prompt Injection)`);
    return { isSafe: true };
  }
}
