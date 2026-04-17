import { query } from '@/db/postgres';
import { logger } from '@/infra/logger';

export class TaskService {
    /**
     * Creates a task from a capture record.
     */
    static async createFromCapture(capture: {
        id: string | number;
        content: string;
        type: string;
        project_id?: string | number | null;
        due_date?: string | Date | null;
    }): Promise<void> {
        if (capture.type !== 'task') return;

        try {
            await query(
                `INSERT INTO tasks (title, status, due_date, project_id, capture_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    capture.content,
                    'pending',
                    capture.due_date || null,
                    capture.project_id || null,
                    capture.id
                ]
            );
            logger.info('task.bridge.created', { captureId: capture.id });
        } catch (err: any) {
            logger.error('task.bridge.failed', { captureId: capture.id, error: err.message });
        }
    }
}
