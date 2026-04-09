import { SkillLoader } from './src/skills/SkillLoader';
import { ToolRegistry } from './src/core/ToolRegistry';

async function verify() {
  const loader = new SkillLoader();
  
  // 1. Fetch Skills (This implicitly runs Validator)
  console.log('--- 1. Carregando Skills (Validador e Fallbacks) ---');
  const skills = loader.fetchSkills();
  skills.forEach(s => {
    console.log(`\n- Nome: ${s.metadata.name}`);
    console.log(`  Capability: ${s.metadata.capability || 'N/A'}`);
    console.log(`  RiskLevel: ${s.metadata.riskLevel}`);
    console.log(`  Status: ${s.metadata.status}`);
    console.log(`  PlannerEnabled: ${s.metadata.plannerEnabled}`);
  });

  // 2. Test Router deterministic match
  console.log('\n--- 2. Testando ActionPlanner (SkillRouter) ---');
  const router = require('./src/skills/SkillRouter').SkillRouter;
  const skillRouter = new router();
  
  // Create a mock experimental skill to ensure it's filtered
  const experimentalSkill = {
      metadata: { name: 'mock-experimental', plannerEnabled: false, priority: 5, intentTriggers: ['mock me'] },
      content: '',
      folderName: 'mock'
  };
  // Create a mock active deterministic skill
  const activeSkill = {
      metadata: { name: 'mock-active', plannerEnabled: true, priority: 10, intentTriggers: ['teste deterministico'] },
      content: '',
      folderName: 'mock-active'
  };

  const testSkills = [...skills, experimentalSkill, activeSkill];

  console.log('\n[Router] Input: "quero rodar um teste deterministico agora"');
  const matched = await skillRouter.route('quero rodar um teste deterministico agora', testSkills);
  if (matched) {
     console.log(`-> Mapeou via Router: ${matched.metadata.name}`);
  }

  // 3. Test Promote
  console.log('\n--- 3. Testando Promoção (Evolution Pipeline) ---');
  const firstSkill = skills.length > 0 ? skills[0].metadata.name : null;
  if (firstSkill) {
      console.log(`A tentativa de promover '${firstSkill}' retornará:`);
      const promoted = loader.promoteSkill(firstSkill);
      console.log(`Sucesso: ${promoted}`);
  }
}

verify().catch(console.error);
