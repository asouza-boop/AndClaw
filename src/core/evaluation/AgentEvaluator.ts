export interface AgentMetrics {
    success: boolean;
    toolUsageCount: number;
    latencyMs: number;
    errorCount: number;
    totalIterations: number;
}

export class AgentEvaluator {
    /**
     * Evaluates a completed or failed AgentLoop run.
     * Logs performance and quality metrics to allow observability.
     */
    public static evaluateRun(metrics: AgentMetrics): void {
        console.log('\n--- [Agent Evaluation Metrics] ---');
        console.log(`[Observability] agent.eval.latency: ${metrics.latencyMs}ms`);
        console.log(`[Observability] agent.eval.toolsUsage: ${metrics.toolUsageCount} calls`);
        console.log(`[Observability] agent.eval.iterations: ${metrics.totalIterations}`);
        console.log(`[Observability] agent.eval.internalErrors: ${metrics.errorCount}`);

        if (metrics.success) {
            console.log(`[Observability] agent.eval.success: Agent completed the workflow successfully.`);
        } else {
            console.warn(`[Observability] agent.eval.failure: Agent was aborted, blocked, or crashed.`);
        }
        console.log('----------------------------------\n');

        // Note: For future capabilities, these metrics can be securely sent to an external
        // analytics datastore, without blocking the agent process (async dispatch).
    }
}
