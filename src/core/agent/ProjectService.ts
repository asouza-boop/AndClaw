import { query } from '@/db/postgres';
import { logger } from '@/infra/logger';

export class ProjectService {
    /**
     * Creates a project from a capture record.
     */
    static async createFromCapture(capture: {
        id: string | number;
        content: string;
        type: string;
        metadata?: any;
    }): Promise<number | null> {
        if (capture.type !== 'project') return null;

        try {
            const rows = await query<any>(
                `INSERT INTO projects (name, status, summary)
                 VALUES ($1, $2, $3) RETURNING id`,
                [
                    capture.content || 'Novo Projeto',
                    'active',
                    `Iniciado via AgentLoop Capture #${capture.id}`
                ]
            );
            logger.info('project.bridge.created', { captureId: capture.id, projectId: rows[0]?.id });
            return rows[0]?.id || null;
        } catch (err: any) {
            logger.error('project.bridge.failed', { captureId: capture.id, error: err.message });
            return null;
        }
    }

    /**
     * Decomposes a project goal into concrete tasks.
     */
    static async decomposeProject(projectId: number, goal: string, agent: any): Promise<void> {
        try {
            const prompt = `Decomponha o objetivo de projeto abaixo em exatamente 3 a 5 tarefas curtas e acionáveis. Responda em lista markdown.\n\nObjetivo: ${goal}`;
            const reply = await agent.processInput('system-bridge', prompt);
            
            const tasks = reply
                .split('\n')
                .map((line: string) => line.replace(/^[-*0-9.\s]+/, '').trim())
                .filter(Boolean)
                .slice(0, 5);

            for (const taskTitle of tasks) {
                await query(
                    `INSERT INTO tasks (title, status, project_id)
                     VALUES ($1, $2, $3)`,
                    [taskTitle, 'pending', projectId]
                );
            }

            logger.info('project.decomposition.completed', { projectId, taskCount: tasks.length });
        } catch (err: any) {
            logger.error('project.decomposition.failed', { projectId, error: err.message });
        }
    }
}
