import { SubAgentResult } from './SubAgentSpawner';

export class ResultAggregator {
    /**
     * Merges sub-agent outputs into a single cohesive response.
     * Handles conflicts by reporting both results transparently.
     */
    public static aggregate(results: SubAgentResult[]): string {
        if (results.length === 0) {
            return '[Sistema] Nenhum resultado de sub-agente para agregar.';
        }

        if (results.length === 1) {
            return results[0].output;
        }

        const successes = results.filter(r => r.success);
        const failures = results.filter(r => !r.success);

        let aggregated = '';

        if (successes.length > 0) {
            for (const r of successes) {
                aggregated += `**Etapa ${r.taskId}** — ${r.description}\n${r.output}\n\n`;
            }
        }

        if (failures.length > 0) {
            aggregated += `---\n⚠️ **Etapas com falha:**\n`;
            for (const r of failures) {
                aggregated += `- Etapa ${r.taskId} (${r.description}): ${r.output.substring(0, 200)}\n`;
            }
        }

        console.log(`[Observability] agent.aggregation.complete: ${successes.length} succeeded, ${failures.length} failed.`);

        return aggregated.trim();
    }
}
