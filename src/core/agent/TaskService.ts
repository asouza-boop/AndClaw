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
        metadata?: Record<string, any> | null;
    }): Promise<void> {
        if (capture.type !== 'task') return;

        // meeting_id: canonical column, not JSONB metadata — consolidated in fix/tasks-audit-cycle
        const meetingId = capture.metadata?.meeting_id || null;

        try {
            const rows = await query(
                `INSERT INTO tasks (title, description, status, due_date, project_id, capture_id, meeting_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, title, due_date`,
                [
                    capture.content,
                    null,
                    'todo',
                    capture.due_date || null,
                    capture.project_id || null,
                    capture.id,
                    meetingId
                ]
            );
            logger.info('task.bridge.created', { captureId: capture.id });
            const task = rows[0];
            if (task && task.due_date) {
                agentEvents.emit(TASK_MUTATED, { taskId: String(task.id), due_date: task.due_date, title: task.title });
            }
        } catch (err: any) {
            logger.error('task.bridge.failed', { captureId: capture.id, error: err.message });
            throw err;
        }
    }



    /**
     * General task creation.
     */
    static async create(data: any): Promise<any> {
        const { title, description, status, priority, due_date, project_id, agent_id, skill_ids, meeting_id } = data;
        if (!title?.trim()) {
            const err = Object.assign(new Error('title is required'), { status: 400 });
            throw err;
        }
        const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'];
        const safeStatus = status && VALID_STATUSES.includes(status) ? status : 'todo';
        const rows = await query<any>(
            `INSERT INTO tasks (title, description, status, priority, due_date, project_id, agent_id, skill_ids, meeting_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [title, description || null, safeStatus, priority || 'normal', due_date || null, project_id || null, agent_id || null, skill_ids || [], meeting_id || null]
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
        const dueDateWasInPayload = 'due_date' in data;
        if (task && dueDateWasInPayload) {
            agentEvents.emit(TASK_MUTATED, {
                taskId: String(task.id),
                due_date: task.due_date || null,
                title: task.title,
                deleted: !task.due_date,
            });
        }
        return task;
    }

    /**
     * General task deletion.
     */
    static async delete(id: string | number): Promise<boolean> {
        // Fetch task before deleting to get gcal_event_id and capture_id
        const rows = await query<any>(
            `SELECT gcal_event_id, capture_id FROM tasks WHERE id = $1`,
            [id]
        );
        if (!rows[0]) return false;

        const { gcal_event_id, capture_id } = rows[0];

        // Delete the task
        const deleted = await query<any>(
            `DELETE FROM tasks WHERE id = $1 RETURNING id`,
            [id]
        );
        if (!deleted[0]) return false;

        // Emit TASK_MUTATED with deleted:true to trigger GCal cleanup
        if (gcal_event_id) {
            agentEvents.emit(TASK_MUTATED, {
                taskId: id,
                due_date: null,
                title: '',
                deleted: true,
                gcal_event_id,
            });
        }

        // Reset capture status if this task came from a capture
        if (capture_id) {
            await query(
                `UPDATE captures SET status = 'new', processed_at = NULL WHERE id = $1`,
                [capture_id]
            ).catch((e: any) =>
                logger.warn('task.delete.capture_reset_failed', { captureId: capture_id, error: e.message })
            );
        }

        return true;
    }
}
