import { Skill } from '../../skills/SkillLoader';
import { SkillContract } from './SkillContract';
import { logger } from '@/infra/logger';

export class SkillValidator {
  public static validate(skill: Skill, existingSkills: Skill[]): boolean {
    const meta = skill.metadata;

    // 1. Required fields
    // Allow backward compatibility by only warning, or reject if strict. 
    // The prompt says "reject skills missing required fields" for name, category, capability, etc. 
    // However, it also says "allow backward compatibility (default values if needed)".
    // I will reject if name is missing (which is already done in SkillLoader), but for category and capability:
    if (!meta.name) {
      logger.error(`[SkillValidator] Rejected skill: missing name.`);
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
    } else if (!['low', 'medium', 'high'].includes(meta.riskLevel)) {
      logger.warn(`[SkillValidator] RiskLevel consistency check failed in '${meta.name}'. Expected low/medium/high, got '${meta.riskLevel}'.`);
      return false;
    }

    if (!meta.status) {
      meta.status = 'experimental';
    }

    // 2. Warn/Reject on duplicate capabilities and triggers
    const duplicateCapability = existingSkills.find(
      s => s.metadata.capability === meta.capability && s.metadata.name !== meta.name
    );
    if (duplicateCapability) {
      logger.warn(`[SkillValidator] Warning: Skill '${meta.name}' shares capability '${meta.capability}' with '${duplicateCapability.metadata.name}'.`);
    }

    if (meta.intentTriggers.length > 0) {
      const duplicateTriggers = existingSkills.find(s => 
        s.metadata.name !== meta.name && 
        s.metadata.intentTriggers?.some(t => meta.intentTriggers!.includes(t))
      );
      if (duplicateTriggers) {
         logger.warn(`[SkillValidator] Warning: Skill '${meta.name}' has overlapping intent triggers with '${duplicateTriggers.metadata.name}'. This will be handled by the prioritized planner.`);
         // No longer rejecting for better multi-skill candidate support
      }
    }

    // 3. Priority conflicts (only warn if priority > 0 to avoid noise on default 0)
    if (meta.priority > 0) {
      const conflict = existingSkills.find(
        s => s.metadata.priority === meta.priority && s.metadata.name !== meta.name
      );
      if (conflict) {
        logger.warn(`[SkillValidator] Warning: Skill '${meta.name}' has priority conflict (${meta.priority}) with '${conflict.metadata.name}'.`);
      }
    }

    // 4. Sandbox Mode Enforcements
    // "never allow direct activation": if this is a newly detected skill (not in cache), ensure it respects sandbox.
    // Given we are parsing existing files, they might already be active. But if `status: 'experimental'`, plannerEnabled must be false.
    if (meta.status === 'experimental' && meta.plannerEnabled === true) {
       logger.warn(`[SkillValidator] Experimental skill '${meta.name}' cannot have plannerEnabled = true. Adjusting or rejecting.`);
       meta.plannerEnabled = false;
    }

    return true;
  }
}

