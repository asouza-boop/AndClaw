import { query } from '@/db/postgres';
import { logger } from '@/infra/logger';
import { MemoryManager } from '@/memory/MemoryManager';
import { buildBatchInsert } from '@/db/utils';
import { agentEvents, MEETING_MUTATED } from '@/core/events/AgentEvents';

export class MeetingService {
    /**
     * Creates a meeting from a capture record.
     */
    static async createFromCapture(capture: {
        id: string | number;
        content: string;
        type: string;
        metadata?: any;
    }): Promise<void> {
        if (capture.type !== 'meeting') return;

        try {
            const rows = await query(
                `INSERT INTO meetings (title, status, meeting_date, notes)
                 VALUES ($1, $2, $3, $4) RETURNING id, title, meeting_date`,
                [
                    capture.content || 'Nova Reunião',
                    'scheduled',
                    new Date().toISOString(), // Default to now if not parsed
                    `Criado via AgentLoop Capture #${capture.id}`
                ]
            );
            logger.info('meeting.bridge.created', { captureId: capture.id });
            const meeting = rows[0];
            if (meeting && meeting.meeting_date) {
                agentEvents.emit(MEETING_MUTATED, { 
                    meetingId: String(meeting.id), 
                    start_time: meeting.meeting_date, 
                    title: meeting.title 
                });
            }
        } catch (err: any) {
            logger.error('meeting.bridge.failed', { captureId: capture.id, error: err.message });
        }
    }

    /**
     * Extracts multi-dimensional intelligence from transcript and persists to OS subsystems.
     */
    static async processIntelligence(meetingId: string | number, transcript: string, agent: any): Promise<any> {
        try {
            const prompt = `Analise a transcrição de reunião abaixo e extraia informações estruturadas. 
Responda APENAS em JSON seguindo o esquema abaixo. Use Português (PT-BR) para os conteúdos.

ESQUEMA:
{
  "tasks": [{"title": "ação curta e acionável", "priority": "high|medium|low"}],
  "decisions": ["lista de decisões objetivas tomadas"],
  "ideas": ["lista de ideias, insights ou pontos criativos"],
  "suggested_project": "String ou null"
}

TRANSCRIÇÃO:
${transcript}`;

            const reply = await agent.processInput('system-intelligence', prompt);
            
            // Handle reply (which might be wrapped in markdown or have extra text)
            const jsonMatch = reply.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("LLM failed to return structured intelligence");
            const data = JSON.parse(jsonMatch[0]);

            // 1. Auto-persist Tasks
            const actionItems = (data.tasks || []).map((t: any) => ({ 
                text: t.title, 
                done: false, 
                priority: t.priority || 'medium' 
            }));
            
            if (actionItems.length > 0) {
                const batchRows = actionItems.map((item: any) => [
                    item.text,
                    'pending',
                    JSON.stringify({
                        source: 'meeting',
                        meeting_id: String(meetingId),
                        created_at: new Date().toISOString()
                    })
                ]);

                const { text, values } = buildBatchInsert(
                    'tasks',
                    ['title', 'status', 'metadata'],
                    batchRows,
                    `ON CONFLICT (title, (metadata->>'meeting_id')) 
                     WHERE metadata->>'meeting_id' IS NOT NULL 
                     DO NOTHING`
                );

                await query('BEGIN');
                try {
                    await query(text, values);
                    await query('COMMIT');
                } catch (err) {
                    await query('ROLLBACK');
                    throw err;
                }
            }

            // 2. Persist Decisions to Long-term Memory
            const memoryManager = new MemoryManager();
            const decisions = data.decisions || [];
            for (const dec of decisions.slice(0, 5)) {
                await memoryManager.addSemanticMemory(
                    `[Meeting Decision] ${dec}`, 
                    { source: 'meeting', meetingId, type: 'meeting_intelligence', memoryType: 'operational' }
                );
            }

            // 3. Persist Ideas to Contextual Memory
            const ideas = data.ideas || [];
            for (const idea of ideas.slice(0, 5)) {
                await memoryManager.addSemanticMemory(
                    `[Meeting Insight] ${idea}`, 
                    { source: 'meeting', meetingId, brainstorm: true, type: 'meeting_intelligence', memoryType: 'contextual' }
                );
            }

            // 4. Update Meeting Record with processed state
            await query(
                `UPDATE meetings 
                 SET action_items = $1::jsonb, 
                     decisions = $2::jsonb, 
                     ideas = $3::jsonb, 
                     status = 'completed' 
                 WHERE id = $4`,
                [JSON.stringify(actionItems), JSON.stringify(decisions), JSON.stringify(ideas), meetingId]
            );

            logger.info('meeting.intelligence.processed', { meetingId, taskCount: actionItems.length, decisionCount: decisions.length });
            return { actionItems, decisions, ideas };
        } catch (err: any) {
            logger.error('meeting.intelligence.failed', { meetingId, error: err.message });
            throw err;
        }
    }

    /**
     * General meeting creation.
     */
    static async create(data: any): Promise<any> {
        const { title, meeting_date, transcript_text, status, duration, participants, summary, action_items, skills_used, notes } = data;
        const rows = await query<any>(
            `INSERT INTO meetings (title, meeting_date, transcript_text, status, duration, participants, summary, action_items, skills_used, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10) RETURNING *`,
            [
                title,
                meeting_date || null,
                transcript_text || null,
                status || 'scheduled',
                duration || null,
                participants || [],
                summary || null,
                JSON.stringify(action_items || []),
                skills_used || [],
                notes || null
            ]
        );
        const meeting = rows[0];
        if (meeting && meeting.meeting_date) {
            agentEvents.emit(MEETING_MUTATED, { 
                meetingId: String(meeting.id), 
                start_time: meeting.meeting_date, 
                title: meeting.title 
            });
        }
        return meeting;
    }

    /**
     * General meeting update.
     */
    static async update(id: string | number, data: any): Promise<any> {
        const updates: string[] = [];
        const params: any[] = [];
        const fields = ['title', 'meeting_date', 'transcript_text', 'status', 'duration', 'participants', 'summary', 'action_items', 'skills_used', 'notes'];
        
        for (const field of fields) {
            if (data[field] !== undefined) {
                if (field === 'action_items') {
                    params.push(JSON.stringify(data[field]));
                    updates.push(`${field} = $${params.length}::jsonb`);
                } else {
                    params.push(data[field]);
                    updates.push(`${field} = $${params.length}`);
                }
            }
        }
        
        if (!updates.length) return null;
        
        params.push(id);
        const rows = await query<any>(
            `UPDATE meetings SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );
        const meeting = rows[0];
        if (meeting && meeting.meeting_date) {
            agentEvents.emit(MEETING_MUTATED, { 
                meetingId: String(meeting.id), 
                start_time: meeting.meeting_date, 
                title: meeting.title 
            });
        }
        return meeting;
    }
}
