export type ClassifiedInput = {
  type: 'task' | 'note' | 'link' | 'meeting' | 'project';
  confidence: number;
};

export class ClassificationService {
  public classifyInput(input: string): ClassifiedInput {
    const text = input.toLowerCase();

    if (text.includes('http://') || text.includes('https://') || text.includes('www.')) {
      return { type: 'link', confidence: 1.0 };
    }

    if (text.includes('reunião') || text.includes('meeting') || text.includes('call') || text.includes('agendar')) {
      return { type: 'meeting', confidence: 0.95 };
    }

    if (text.includes('fazer') || text.includes('todo') || text.includes('preciso') || text.includes('task') || text.includes('devo')) {
      return { type: 'task', confidence: 0.9 };
    }

    if (text.includes('projeto') || text.includes('project') || text.includes('roadmap') || text.includes('iniciar plano')) {
      return { type: 'project', confidence: 0.85 };
    }

    if (text.includes('reunião') || text.includes('meeting') || text.includes('call') || text.includes('vídeo') || text.includes('conversa agendada')) {
      return { type: 'meeting', confidence: 0.95 };
    }

    const isLongText = input.length > 250 || (input.match(/\n/g) || []).length >= 3;
    return {
      type: 'note',
      confidence: isLongText ? 0.9 : 0.7,
    };
  }
}
