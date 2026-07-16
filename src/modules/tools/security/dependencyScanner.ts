import { logger } from '@/infra/logger';
export class DependencyScanner {
  // Simple heuristic for potentially malicious dependency execution patterns
  private static readonly SUSPICIOUS_PATTERNS = [
    /;\s*(rm |curl |wget |bash |sh )/i, // Command injection
    /&&\s*(rm |curl |wget |bash |sh )/i,
    /\|\s*(bash|sh)/i,
    /`.*`/i, // Backticks execution
    /\$\(.*\)/i, // Subshell execution
    />\s*\/dev\/(tcp|udp)/i // Reverse shell
  ];

  public static scan(args: any): { isSafe: boolean; reason?: string } {
    if (!args) {
      return { isSafe: true };
    }

    const payload = typeof args === 'string' ? args : JSON.stringify(args);
    const normalizedPayload = payload.toLowerCase();

    // 1. Detect suspicious execution patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(normalizedPayload)) {
         logger.info(`[Observability] security.scan.result: Failed (Dependency/Payload Scanner)`);
         logger.warn(`[Observability] security.blocked: Execution blocked due to suspicious payload pattern matching ${pattern.toString()}`);
         return { isSafe: false, reason: 'Suspicious payload or command injection pattern detected' };
      }
    }

    // 2. Detect common dependency typos or malformed names (very high-level heuristic)
    // E.g., looking for "npm install something" and blocking if it has suspicious chars
    const installMatch = normalizedPayload.match(/(npm|yarn|pnpm|pip)\s+(install|i|add)\s+([^"'\s}]+)/i);
    if (installMatch && installMatch[3]) {
      const packageName = installMatch[3];
      // If the package name contains strange characters, flag it.
      if (/[<>&|!*$]/.test(packageName)) {
         logger.info(`[Observability] security.scan.result: Failed (Dependency/Payload Scanner)`);
         logger.warn(`[Observability] security.blocked: Execution blocked due to malformed dependency name: ${packageName}`);
         return { isSafe: false, reason: 'Malformed dependency name detected' };
      }
    }

    // logger.info(`[Observability] security.scan.result: Passed (Dependency Scanner)`);
    return { isSafe: true };
  }
}
