import request from 'supertest';
import express from 'express';
import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/env';
import skillsRouter from './skills.routes';
import { SkillLoader } from '../../skills/SkillLoader';

const app = express();
app.use(express.json());
app.use('/', skillsRouter);

async function runTests() {
  console.log("Running skills.routes integration tests...");
  
  const testSlug = 'test-skill-invalidation';
  
  // Clean up any previous run
  try {
    await fs.rm(path.join(config.paths.skills, testSlug), { recursive: true, force: true });
  } catch(e) {}
  
  SkillLoader.invalidateAll();
  
  // 7. POST /skills response is 201 AND SkillLoader cache is fully cleared
  const postRes = await request(app)
    .post('/skills')
    .send({ slug: testSlug, title: 'Test Skill', content: 'test content' });
    
  assert.strictEqual(postRes.status, 201, "POST should return 201");
  const loader = new SkillLoader();
  const skillsAfterPost = loader.fetchSkills(); // This reloads from disk
  const found = skillsAfterPost.find(s => s.metadata.name === testSlug);
  assert.ok(found, "Newly created skill should be loaded after POST");
  
  // 5. PUT /skills/:id response is 200 AND SkillLoader cache no longer contains that slug
  const putRes = await request(app)
    .put(`/skills/${testSlug}`)
    .send({ content: 'updated content' });
    
  assert.strictEqual(putRes.status, 200, "PUT should return 200");
  const skillsAfterPut = loader.fetchSkills(); // Since PUT only invalidates the slug, fetchSkills returns the cache WITHOUT the slug!
  assert.strictEqual(skillsAfterPut.find(s => s.metadata.name === testSlug), undefined, "Cache should not contain slug after invalidate");
  
  // 6. DELETE /skills/:id response is 200 AND SkillLoader cache no longer contains that slug
  // Let's populate the cache first
  SkillLoader.invalidateAll();
  loader.fetchSkills();
  
  const delRes = await request(app).delete(`/skills/${testSlug}`);
  assert.strictEqual(delRes.status, 200, "DELETE should return 200");
  
  const skillsAfterDelete = loader.fetchSkills();
  assert.strictEqual(skillsAfterDelete.find(s => s.metadata.name === testSlug), undefined, "Cache should not contain slug after DELETE");

  console.log("✅ src/server/routes/skills.routes.test.ts passed");
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
