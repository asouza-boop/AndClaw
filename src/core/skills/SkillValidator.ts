import { Skill } from '../../skills/SkillLoader';

export class SkillValidator {
  public static validate(skill: Skill, existingSkills: Skill[]): boolean {
    const meta = skill.metadata;

    // 1. Required fields
    // Allow backward compatibility by only warning, or reject if strict. 
    // The prompt says "reject skills missing required fields" for name, category, capability, etc. 
    // However, it also says "allow backward compatibility (default values if needed)".
    // I will reject if name is missing (which is already done in SkillLoader), but for category and capability:
    if (!meta.name) {
      console.error(`[SkillValidator] Rejected skill: missing name.`);
      return false;
    }

    if (!meta.category) {
      meta.category = 'integration'; // fallback
    }

    if (!meta.capability) {
      meta.capability = `default-capability-${meta.name}`; // fallback
    }

    if (meta.plannerEnabled === undefined) {
      meta.plannerEnabled = true;
    }

    if (!meta.intentTriggers || !Array.isArray(meta.intentTriggers)) {
      meta.intentTriggers = [];
    }

    if (meta.priority === undefined) {
      meta.priority = 0;
    }

    if (!meta.riskLevel) {
      meta.riskLevel = 'low';
    }

    // 2. Warn on duplicate capabilities
    const duplicateCapability = existingSkills.find(
      s => s.metadata.capability === meta.capability && s.metadata.name !== meta.name
    );
    if (duplicateCapability) {
      console.warn(`[SkillValidator] Warning: Skill '${meta.name}' shares capability '${meta.capability}' with '${duplicateCapability.metadata.name}'.`);
    }

    // 3. Priority conflicts (only warn if priority > 0 to avoid noise on default 0)
    if (meta.priority > 0) {
      const conflict = existingSkills.find(
        s => s.metadata.priority === meta.priority && s.metadata.name !== meta.name
      );
      if (conflict) {
        console.warn(`[SkillValidator] Warning: Skill '${meta.name}' has priority conflict (${meta.priority}) with '${conflict.metadata.name}'.`);
      }
    }

    return true;
  }
}
