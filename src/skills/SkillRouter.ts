import { ProviderFactory } from '../providers/ProviderFactory';
import { Skill } from './SkillLoader';
import { config } from '../config/env';

export class SkillRouter {
  
  /**
   * Passo Zero: Determina qual Skill deve ser usada para um dado input do usuário.
   */
  public async route(input: string, availableSkills: Skill[]): Promise<Skill | null> {
    if (availableSkills.length === 0) return null;

    const provider = ProviderFactory.getProvider(config.llm.defaultProvider);
    await provider.initialize();

    const skillsPrompt = availableSkills.map(s => `- ${s.metadata.name}: ${s.metadata.description}`).join('\n');
    
    const systemPrompt = `Você é um roteador de intenções (Router).
Analise o input do usuário e decida qual das habilidades (skills) disponíveis é a melhor para tratar o problema.
Se NENHUMA habilidade for compatível com o input, retorne NULO.
VOCÊ DEVE RESPONDER ESTRITAMENTE EM JSON, contendo apenas a chave "skillName".
Exemplo de Saída Positiva: {"skillName": "analista-de-codigo"}
Exemplo de Saída Negativa: {"skillName": null}

Habilidades Disponíveis:
${skillsPrompt}
`;

    try {
      const response = await provider.generateResponse(
        systemPrompt, 
        [{ role: 'user', content: input }], 
        []
      );
      
      const jsonText = response.text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonText);
      
      if (parsed.skillName) {
        const matchedSkill = availableSkills.find(s => s.metadata.name === parsed.skillName);
        return matchedSkill || null;
      }
      return null;
    } catch (e) {
      console.error('[SkillRouter] Error routing intent:', e);
      return null; // Fallback to casual chat
    }
  }
}
