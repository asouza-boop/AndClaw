import { query } from '@/db/postgres';
import { logger } from '@/infra/logger';
import { TaskService } from './TaskService';
import { MemoryManager } from '@/memory/MemoryManager';

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
            await query(
                `INSERT INTO meetings (title, status, meeting_date, notes)
                 VALUES ($1, $2, $3, $4)`,
                [
                    capture.content || 'Nova Reunião',
                    'scheduled',
                    new Date().toISOString(), // Default to now if not parsed
                    `Criado via AgentLoop Capture #${capture.id}`
                ]
            );
            logger.info('meeting.bridge.created', { captureId: capture.id });
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
            
            for (const item of actionItems) {
                await TaskService.createFromMeetingAction(meetingId, item.text);
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
}
