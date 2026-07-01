import { SkillLoader } from './SkillLoader';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { config } from '@/config/env';

async function runTests() {
  const originalDateNow = Date.now;
  const originalSkillsPath = config.paths.skills;
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'andclaw-skillloader-'));

  try {
    console.log("Running SkillLoader tests...");
    
    // Clear cache initially
    SkillLoader.invalidateAll();
    
    const loader = new SkillLoader();
    let skills = loader.fetchSkills(); // Populates cache
    const initialCount = skills.length;
    
    // 1. invalidate(slug) removes the specific entry
    if (initialCount > 0) {
      const firstSlug = skills[0].metadata.name;
      SkillLoader.invalidate(firstSlug);
      
      // Since fetchSkills returns the cache array, it should be missing this skill
      const cached = loader.fetchSkills();
      assert.strictEqual(cached.length, initialCount - 1, "Cache should have 1 less skill");
      assert.ok(!cached.find(s => s.metadata.name === firstSlug), "Skill should be removed");
    }
    
    // 2. invalidate('nonexistent') does not throw
    assert.doesNotThrow(() => {
      SkillLoader.invalidate('nonexistent-slug');
    }, "Should not throw on nonexistent slug");
    
    // 3. invalidateAll() clears all entries
    SkillLoader.invalidateAll();
    // Subsequent fetchSkills reloads from disk
    skills = loader.fetchSkills();
    assert.strictEqual(skills.length, initialCount, "Should reload all from disk");
    
    // 4. TTL fallback still works
    Date.now = () => originalDateNow() + 61000; // Fast forward 61 seconds
    
    const newLoader = new SkillLoader();
    const skillsAfterTTL = newLoader.fetchSkills();
    assert.strictEqual(skillsAfterTTL.length, initialCount, "Should reload from disk after TTL");

    // 5. promoteSkill persists to disk
    const promotedSlug = 'promote-persist-test';
    const promotedDir = path.join(tmpRoot, promotedSlug);
    fs.mkdirSync(promotedDir, { recursive: true });
    fs.writeFileSync(path.join(promotedDir, 'SKILL.md'), `---\nname: ${promotedSlug}\ndescription: test skill\nstatus: experimental\nplannerEnabled: false\n---\n\n# Test\n`, 'utf-8');
    config.paths.skills = tmpRoot;
    SkillLoader.invalidateAll();
    const promotedLoader = new SkillLoader();
    promotedLoader.fetchSkills();
    assert.strictEqual(promotedLoader.promoteSkill(promotedSlug), true, 'promoteSkill should return true');
    SkillLoader.invalidateAll();
    const reloaded = promotedLoader.fetchSkills();
    const promoted = reloaded.find((skill) => skill.metadata.name === promotedSlug);
    assert.ok(promoted, 'Promoted skill must be reloaded from disk');
    assert.strictEqual(promoted!.metadata.status, 'active');
    assert.strictEqual(promoted!.metadata.plannerEnabled, true);

    console.log("✅ src/skills/SkillLoader.test.ts passed");
  } finally {
    Date.now = originalDateNow;
    config.paths.skills = originalSkillsPath;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    SkillLoader.invalidateAll();
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
