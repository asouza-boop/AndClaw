import { SkillContract } from './SkillContract';

export class SkillFactory {
  /**
   * Scaffolds a new Skill Contract.
   * Enforces experimental sandbox state to ensure deterministic routing until promoted.
   */
  public static createNewSkill(args: Partial<SkillContract>): SkillContract {
    const rawName = args.name || `skill_${Date.now()}`;
    const name = rawName.replace(/[^a-zA-Z0-9_\-]/g, '_');

    const skill: SkillContract = {
      name,
      description: args.description || 'A newly generated skill.',
      category: args.category || 'integration',
      capability: args.capability || `default-capability-${name}`,
      intentTriggers: args.intentTriggers || [],
      priority: args.priority || 0,
      riskLevel: args.riskLevel || 'medium',
      
      // Sandbox enforcement
      status: 'experimental',
      plannerEnabled: false
    };

    console.log(`[Observability] skill.created: '${skill.name}' (Status: experimental)`);
    
    return skill;
  }
}
