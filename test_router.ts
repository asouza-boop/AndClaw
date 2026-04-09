import { SkillLoader } from './src/skills/SkillLoader';
import { SkillRouter } from './src/skills/SkillRouter';
import { config } from './src/config/env';

async function test() {
    console.log("Testing SkillRouter...");
    
    const loader = new SkillLoader();
    const skills = loader.fetchSkills();
    const router = new SkillRouter();
    
    const testInputs = [
        "Preciso de ajuda pra pensar num novo recurso complexo",
        "Como eu listo arquivos no linux usando o terminal?",
        "Qual a previsão do tempo?"
    ];
    
    for (const input of testInputs) {
        console.log(`\nInput: "${input}"`);
        const skill = await router.route(input, skills);
        if (skill) {
            console.log(`Detected Skill: ${skill.metadata.name}`);
        } else {
            console.log("No skill detected (Casual mode)");
        }
    }
}

test().catch(console.error);
