import { SkillLoader } from './SkillLoader';
import assert from 'assert';

async function runTests() {
  const originalDateNow = Date.now;

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

    console.log("✅ src/skills/SkillLoader.test.ts passed");
  } finally {
    Date.now = originalDateNow;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
