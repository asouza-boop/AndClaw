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
    static async processIntelligence(
        meetingId: string | number,
        transcript: string,
        agent: any,
        participants: string[] = []
    ): Promise<any> {
        try {
            const participantsHint = participants && participants.length > 0
                ? `\nPARTICIPANTES CONHECIDOS: ${participants.join(', ')}`
                : '';

            const prompt = `Você é um especialista em análise de reuniões. Analise a transcrição abaixo e extraia inteligência estruturada em 7 dimensões. Responda APENAS em JSON válido. Use Português (PT-BR).${participantsHint}

ESQUEMA OBRIGATÓRIO:
{
  "tasks_immediate": [
    {"title": "ação clara e acionável agora", "priority": "high|medium|low", "owner": "nome ou null"}
  ],
  "tasks_future": [
    {"title": "follow-up ou ação futura com condição ou prazo", "priority": "high|medium|low", "when": "descrição do prazo ou condição"}
  ],
  "key_points": [
    "ponto principal 1",
    "ponto principal 2"
  ],
  "alerts": [
    {"description": "risco, bloqueador ou sinal de atenção", "severity": "high|medium|low"}
  ],
  "ideas": [
    "insight criativo ou oportunidade identificada"
  ],
  "decisions": [
    "decisão tomada e registrada"
  ],
  "memory_highlights": [
    "informação que mudaria decisões futuras e deve ser lembrada"
  ],
  "participants_identified": [
    {"name": "nome identificado na transcrição", "role": "papel inferido ou null"}
  ]
}

TRANSCRIÇÃO:
${transcript}`;

            await query('BEGIN');
            const reply = await agent.processInput('system-intelligence', prompt);
            let actionItems: any[] = [];
            let tasks_future: any[] = [];
            let key_points: any[] = [];
            let alerts: any[] = [];
            let ideas: any[] = [];
            let decisions: any[] = [];
            let memory_highlights: any[] = [];
            let participants_identified: any[] = [];

            try {
                let data: any;
                try {
                    data = JSON.parse(reply);
                } catch {
                    throw new Error('LLM failed to return structured intelligence');
                }

                const tasks_immediate = Array.isArray(data.tasks_immediate) ? data.tasks_immediate : [];
                tasks_future = Array.isArray(data.tasks_future) ? data.tasks_future : [];
                key_points = Array.isArray(data.key_points) ? data.key_points : [];
                alerts = Array.isArray(data.alerts) ? data.alerts : [];
                ideas = Array.isArray(data.ideas) ? data.ideas : [];
                decisions = Array.isArray(data.decisions) ? data.decisions : [];
                memory_highlights = Array.isArray(data.memory_highlights) ? data.memory_highlights : [];
                participants_identified = Array.isArray(data.participants_identified) ? data.participants_identified : [];

                actionItems = tasks_immediate.map((t: any) => ({
                    text: t.title,
                    done: false,
                    priority: t.priority || 'medium',
                    owner: t.owner || null,
                }));

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

                const memoryManager = new MemoryManager();

                if (actionItems.length > 0) {
                    await query(text, values);
                }

                for (const dec of decisions.slice(0, 5)) {
                    await memoryManager.addSemanticMemory(
                        `[Meeting Decision] ${dec}`,
                        { source: 'meeting', meetingId, type: 'meeting_intelligence', memoryType: 'operational' }
                    );
                }

                for (const idea of ideas.slice(0, 5)) {
                    await memoryManager.addSemanticMemory(
                        `[Meeting Insight] ${idea}`,
                        { source: 'meeting', meetingId, brainstorm: true, type: 'meeting_intelligence', memoryType: 'contextual' }
                    );
                }

                for (const ft of tasks_future.slice(0, 5)) {
                    await memoryManager.addSemanticMemory(
                        `[Follow-up] ${ft.title}${ft.when ? ` — ${ft.when}` : ''}`,
                        { source: 'meeting', meetingId, type: 'meeting_intelligence', memoryType: 'operational' }
                    );
                }

                for (const mh of memory_highlights.slice(0, 3)) {
                    await memoryManager.addSemanticMemory(
                        `[Memory Highlight] ${mh}`,
                        { source: 'meeting', meetingId, type: 'meeting_highlight', memoryType: 'permanent', importance: 'high' }
                    );
                }

                await query(
                    `UPDATE meetings
                     SET action_items = $1::jsonb,
                         decisions = $2::jsonb,
                         ideas = $3::jsonb,
                         key_points = $4::jsonb,
                         alerts = $5::jsonb,
                         tasks_future = $6::jsonb,
                         memory_highlights = $7::jsonb,
                         participants_identified = $8::jsonb,
                         status = 'completed'
                     WHERE id = $9`,
                    [
                        JSON.stringify(actionItems),
                        JSON.stringify(decisions),
                        JSON.stringify(ideas),
                        JSON.stringify(key_points),
                        JSON.stringify(alerts),
                        JSON.stringify(tasks_future),
                        JSON.stringify(memory_highlights),
                        JSON.stringify(participants_identified),
                        meetingId
                    ]
                );

                await query('COMMIT');
            } catch (err) {
                await query('ROLLBACK');
                throw err;
            }

            logger.info('meeting.intelligence.processed', {
                meetingId,
                taskCount: actionItems.length,
                decisionCount: decisions.length,
                futureTaskCount: tasks_future.length,
            });
            return { actionItems, tasks_future, decisions, ideas, key_points, alerts, memory_highlights, participants_identified };
        } catch (err: any) {
            logger.error('meeting.intelligence.failed', { meetingId, error: err.message });
            throw err;
        }
    }

    /**
     * General meeting creation.
     */
    static async create(data: any): Promise<any> {
        if (data && data.meeting_date === undefined) {
            if (data.date !== undefined) {
                data.meeting_date = data.date;
            } else if (data.start !== undefined) {
                data.meeting_date = data.start;
            }
        }
        if (data && data.notes === undefined) {
            const extraNotes = [data.description, data.location].filter(Boolean).join(' | ');
            if (extraNotes) data.notes = extraNotes;
        }
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
