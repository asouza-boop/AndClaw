import { ToolRegistry } from '../ToolRegistry';
import { DependencyScanner } from '../../modules/tools/security/dependencyScanner';
import { logger } from '@/infra/logger';

export interface ExecutionStep {
    name: string;
    arguments: any;
}

export interface ExecutionResult {
    name: string;
    observation: string;
    success: boolean;
}

export class ExecutionOrchestrator {
    private registry: ToolRegistry;

    constructor(registry: ToolRegistry) {
        this.registry = registry;
    }

    /**
     * Executes a series of tool call steps sequentially.
     * Retries failed steps exactly once.
     * Passes outputs (or context) between steps sequentially if supported.
     */
    public async executeSteps(steps: ExecutionStep[]): Promise<ExecutionResult[]> {
        const results: ExecutionResult[] = [];
        let previousOutput: any = null;

        for (const step of steps) {
            logger.info(`[Observability] execution.step.start: ${step.name}`);
            let observation = "";
            let success = false;
            
            const tool = this.registry.getTool(step.name);

            if (!tool) {
                observation = `Erro: Ferramenta '${step.name}' não existe no ToolRegistry local.`;
                logger.info(`[Observability] execution.error: ${observation}`);
            } else {
                // 1. Dependency/Security check
                const dependencyCheck = DependencyScanner.scan(step.arguments);
                if (!dependencyCheck.isSafe) {
                    observation = `[Erro de Segurança] O agente tentou executar uma ação bloqueada pelas diretrizes de proteção (Supply Chain Sentinel): ${dependencyCheck.reason}`;
                    logger.info(`[Observability] execution.error: Security Blocked for ${step.name}`);
                    // Throw immediately to abort the whole loop
                    throw new Error(observation);
                }

                // 2. Execution with Retry bounds
                let retries = 1;
                while (retries >= 0) {
                    try {
                        // Pass previous output if the interface permits it in the future, 
                        // for now we stick to step.arguments for backward compatibility,
                        // while keeping previousOutput recorded.
                        observation = await tool.execute(step.arguments);
                        success = true;
                        previousOutput = observation;
                        break; 
                    } catch (e: any) {
                        logger.info(`[Observability] execution.error: Failed to execute ${step.name}: ${e.message}`);
                        if (retries > 0) {
                            logger.info(`[ExecutionOrchestrator] Retrying step ${step.name}...`);
                            retries--;
                        } else {
                            observation = `Falha ao executar ${step.name}: ${e.message}`;
                            break;
                        }
                    }
                }
            }

            logger.info(`[Observability] execution.step.end: ${step.name}`);
            results.push({ name: step.name, observation, success });
        }

        return results;
    }
}
