import { SkillLoader } from './src/skills/SkillLoader';
import { config } from './src/config/env';

async function test() {
    console.log("Testing SkillLoader...");
    console.log("Skills Path:", config.paths.skills);
    
    const loader = new SkillLoader();
    const skills = loader.fetchSkills();
    
    console.log(`Found ${skills.length} skills:`);
    skills.forEach(s => {
        console.log(`- ${s.metadata.name}: ${s.metadata.description}`);
    });
}

test().catch(console.error);
