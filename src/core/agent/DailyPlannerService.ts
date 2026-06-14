import { query } from '@/db/postgres';
import { logger } from '@/infra/logger';
import { ProviderFactory } from '@/providers/ProviderFactory';
import { MemoryService } from '@/core/memory/MemoryService';

export class DailyPlannerService {
    /**
     * Retrieves or generates a personalized daily briefing for the user.
     */
    static async getDailyBriefing(userId: string): Promise<any> {
        try {
            // 1. Check if briefing exists for today
            const existing = await query<{ content: any }>(
                `SELECT content FROM daily_briefings WHERE user_id = $1 AND briefing_date = CURRENT_DATE`,
                [userId]
            );

            if (existing.length > 0) {
                return existing[0].content;
            }

            // 2. Aggregate Data
            // NOTE: tasks table has no user_id column — scoping deferred until column is added
            // When user_id is added to tasks, filter with: WHERE status = 'pending' AND user_id = $1
            const tasks = await query<any>(
                `SELECT title, priority FROM tasks WHERE status NOT IN ('done', 'cancelled') ORDER BY priority = 'high' DESC LIMIT 10`
            );
            logger.warn('daily_briefing.tasks_unscoped', { userId, reason: 'tasks table missing user_id column' });
            
            // NOTE: calendar_events table has no user_id column — scoping deferred until column is added
            // When user_id is added to calendar_events, filter with: WHERE start_time >= CURRENT_DATE AND start_time < CURRENT_DATE + INTERVAL '1 day' AND user_id = $1
            const todayEvents = await query<any>(
                `SELECT summary as title, start_time FROM calendar_events 
                 WHERE start_time >= CURRENT_DATE AND start_time < CURRENT_DATE + INTERVAL '1 day' 
                 ORDER BY start_time ASC`
            );
            logger.warn('daily_briefing.calendar_events_unscoped', { userId, reason: 'calendar_events table missing user_id column' });

            const upcomingMeetings = await query<any>(
                `SELECT title, meeting_date, summary FROM meetings
                 WHERE meeting_date >= CURRENT_DATE AND meeting_date < CURRENT_DATE + INTERVAL '7 day'
                 AND status != 'cancelled'
                 ORDER BY meeting_date ASC LIMIT 5`
            );

            const memoryService = new MemoryService();
            const recentMemories = await memoryService.searchByText("Recent priorities and work context", 5);

            // 3. Generate Briefing via LLM
            const prompt = this.buildPrompt(tasks, todayEvents, upcomingMeetings, recentMemories);
            const provider = ProviderFactory.getChain();
            const response = await provider.generateResponse(prompt, [], []);

            const content = this.parseResponse(response.text);
            
            // 4. Persistence
            await query(
                `INSERT INTO daily_briefings (user_id, content) VALUES ($1, $2::jsonb)
                 ON CONFLICT (user_id, briefing_date) DO UPDATE SET content = $2::jsonb`,
                [userId, JSON.stringify(content)]
            );
            
            logger.info('agent.daily_briefing.generated', { userId });
            return content;
        } catch (err: any) {
            logger.error('agent.daily_briefing.failed', { error: err.message });
            // Fallback content in case of absolute failure
            return {
                focus: "Retomar atividades pendentes",
                actions: ["Revisar lista de tarefas", "Organizar reuniões do dia"],
                risks: ["Conexão instável ou latência no Agent"],
                quick_wins: ["Processar 3 itens do Inbox"]
            };
        }
    }

    private static parseResponse(text: string): any {
        try {
            const jsonPart = text.match(/\{[\s\S]*\}/);
            if (!jsonPart) throw new Error("No JSON found in response");
            return JSON.parse(jsonPart[0]);
        } catch (e) {
            logger.warn('agent.daily_briefing.json_parse_failed', { text });
            throw e;
        }
    }

    private static buildPrompt(tasks: any[], todayEvents: any[], upcomingMeetings: any[], memories: any[]): string {
        return `Você é o Daily Copilot do AndClaw OS. Sua missão é preparar o usuário para o dia sintetizando tarefas, reuniões e memórias.
Responda APENAS em JSON estruturado seguindo o esquema abaixo. Use Português (PT-BR) para o conteúdo.

ESQUEMA:
{
  "focus": "Resumo do tema central/prioridade do dia",
  "actions": ["Lista de 3 a 5 ações sugeridas"],
  "risks": ["Possíveis gargalos ou conflitos"],
  "quick_wins": ["Pequenas vitórias possíveis hoje"]
}

DADOS ATUAIS:
- TAREFAS: ${JSON.stringify(tasks)}
- AGENDA DE HOJE: ${JSON.stringify(todayEvents)}
- REUNIÕES PRÓXIMAS (7 dias): ${JSON.stringify(upcomingMeetings)}
- CONTEXTO: ${JSON.stringify(memories.map(m => m.content))}

Gere um briefing estratégico, direto e motivador. Evite placeholders.`;
    }
}
