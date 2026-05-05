import { query } from '@/db/postgres';
import { logger } from '@/infra/logger';
import { agentEvents, TASK_MUTATED } from '@/core/events/AgentEvents';

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
            const rows = await query(
                `INSERT INTO tasks (title, status, due_date, project_id, capture_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id, title, due_date`,
                [
                    capture.content,
                    'pending',
                    capture.due_date || null,
                    capture.project_id || null,
                    capture.id
                ]
            );
            logger.info('task.bridge.created', { captureId: capture.id });
            const task = rows[0];
            if (task && task.due_date) {
                agentEvents.emit(TASK_MUTATED, { taskId: String(task.id), due_date: task.due_date, title: task.title });
            }
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

    /**
     * General task creation.
     */
    static async create(data: any): Promise<any> {
        const { title, description, status, priority, due_date, project_id, agent_id, skill_ids, meeting_id } = data;
        const rows = await query<any>(
            `INSERT INTO tasks (title, description, status, priority, due_date, project_id, agent_id, skill_ids, meeting_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [title, description || null, status || 'open', priority || 'normal', due_date || null, project_id || null, agent_id || null, skill_ids || [], meeting_id || null]
        );
        const task = rows[0];
        if (task && task.due_date) {
            agentEvents.emit(TASK_MUTATED, { taskId: String(task.id), due_date: task.due_date, title: task.title });
        }
        return task;
    }

    /**
     * General task update.
     */
    static async update(id: string | number, data: any): Promise<any> {
        const updates: string[] = [];
        const params: any[] = [];
        const fields = ['title', 'description', 'status', 'priority', 'due_date', 'agent_id', 'skill_ids'];
        
        for (const field of fields) {
            if (data[field] !== undefined) {
                params.push(data[field] === '' && field === 'due_date' ? null : data[field]);
                updates.push(`${field} = $${params.length}`);
            }
        }
        
        if (!updates.length) return null;
        
        params.push(id);
        const rows = await query<any>(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );
        const task = rows[0];
        if (task && task.due_date) {
            agentEvents.emit(TASK_MUTATED, { taskId: String(task.id), due_date: task.due_date, title: task.title });
        }
        return task;
    }

    /**
     * General task deletion.
     */
    static async delete(id: string | number): Promise<void> {
        await query('DELETE FROM tasks WHERE id = $1', [id]);
    }
}
