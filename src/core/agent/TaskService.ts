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

    /**
     * Creates a task from a meeting action item.
     */
    static async createFromMeetingAction(meetingId: string | number, actionText: string): Promise<void> {
        try {
            // Duplicate check: same meeting and same title
            const existing = await query(
                `SELECT id FROM tasks WHERE title = $1 AND metadata->>'meeting_id' = $2`,
                [actionText, String(meetingId)]
            );

            if (existing.length > 0) {
                logger.info('task.meeting_bridge.skipped', { meetingId, title: actionText, reason: 'duplicate' });
                return;
            }

            await query(
                `INSERT INTO tasks (title, status, metadata)
                 VALUES ($1, $2, $3::jsonb)`,
                [
                    actionText,
                    'pending',
                    JSON.stringify({
                        source: 'meeting',
                        meeting_id: meetingId,
                        created_at: new Date().toISOString()
                    })
                ]
            );
            logger.info('task.meeting_bridge.created', { meetingId, title: actionText });
        } catch (err: any) {
            logger.error('task.meeting_bridge.failed', { meetingId, error: err.message });
        }
    }
}
