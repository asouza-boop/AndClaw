export interface Suggestion {
    type: 'task' | 'memory' | 'calendar' | 'project';
    label: string;
    action: string;
    data: any;
}

export class SuggestionService {
    /**
     * Detects potential proactive actions from the agent's text response using lightweight heuristics.
     */
    static detect(text: string): Suggestion[] {
        const suggestions: Suggestion[] = [];
        const lowerText = text.toLowerCase();

        // 1. Task Detection
        const taskRegex = /(preciso|deve|importante|agendar|combinar|enviar|fazer|ação|todo|pendência)/i;
        if (taskRegex.test(lowerText)) {
            // Try to extract a clean title from the text
            // For now, use a generic "Criar Task" or a snippet
            suggestions.push({
                type: 'task',
                label: '🚀 Criar Task',
                action: 'create_task',
                data: { title: this.extractContext(text, ['preciso', 'deve', 'fazer']) }
            });
        }

        // 2. Memory Detection
        if (text.length > 250 || /(lembre-se|importante lembrar|memorize|grave isso|resumo)/i.test(lowerText)) {
            suggestions.push({
                type: 'memory',
                label: '🧠 Salvar na Memória',
                action: 'store_memory',
                data: { content: text }
            });
        }

        // 3. Calendar / Follow-up Detection
        if (/(amanhã|semana que vem|próxima|reunião|call|follow-up)/i.test(lowerText)) {
            suggestions.push({
                type: 'calendar',
                label: '📅 Agendar Follow-up',
                action: 'schedule_call',
                data: { title: `Follow-up: ${this.extractContext(text, ['amanhã', 'reunião', 'call'])}` }
            });
        }

        return suggestions.slice(0, 3); // Capped for UI cleanliness
    }

    private static extractContext(text: string, triggers: string[]): string {
        const lines = text.split('\n').filter(l => l.length > 5);
        for (const line of lines) {
            for (const trigger of triggers) {
                if (line.toLowerCase().includes(trigger)) {
                    return line.replace(/^[-*>\s]+/, '').trim();
                }
            }
        }
        return "Nova ação sugerida";
    }
}
