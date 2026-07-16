import { ProviderFactory } from '@/providers/ProviderFactory';
import { Skill } from './SkillLoader';
import { config } from '@/config/env';
import { logger } from '@/infra/logger';

export class SkillRouter {
  
  /**
   * Passo Zero: Determina qual Skill deve ser usada para um dado input do usuário.
   */
  public async route(input: string, availableSkills: Skill[]): Promise<Skill | null> {
    if (availableSkills.length === 0) return null;

    // 1. Only consider plannerEnabled = true
    let validSkills = availableSkills.filter(s => s.metadata.plannerEnabled !== false);

    if (validSkills.length === 0) return null;

    // 2. Rank by priority (descending)
    validSkills.sort((a, b) => (b.metadata.priority || 0) - (a.metadata.priority || 0));

    // 3. Match by intentTriggers (Deterministic match first)
    const normalizedInput = input.toLowerCase();
    for (const skill of validSkills) {
      const triggers = skill.metadata.intentTriggers || [];
      for (const trigger of triggers) {
        if (normalizedInput.includes(trigger.toLowerCase())) {
          logger.info(`[SkillRouter] Exact trigger match: '${trigger}' -> ${skill.metadata.name}`);
          return skill;
        }
      }
    }

    // 4. Fallback to LLM Routing
    const provider = ProviderFactory.getChain();
    await provider.initialize();

    const skillsPrompt = validSkills.map(s => `- ${s.metadata.name}: ${s.metadata.description}`).join('\n');
    
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
        const matchedSkill = validSkills.find(s => s.metadata.name === parsed.skillName);
        return matchedSkill || null;
      }
      return null;
    } catch (e) {
      logger.error('skill_router.routing_failed', {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      return null; // Fallback to casual chat
    }
  }
}
