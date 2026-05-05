import request from 'supertest';
import express from 'express';
import assert from 'assert';
import opsRoutes from './ops.routes';

const app = express();
app.use(express.json());
// Mock the mount point from app.ts
app.use('/api', opsRoutes);

async function runTests() {
  console.log("Running ops.routes integration tests...");

  // Bug 1 - Prefix verification
  console.log("Test: GET /api/learning/dashboard (Prefix fix)");
  const resDashboard = await request(app).get('/api/learning/dashboard');
  assert.notStrictEqual(resDashboard.status, 404, "GET /api/learning/dashboard should not be 404");
  assert.strictEqual(resDashboard.status, 200, "GET /api/learning/dashboard should be 200");

  // Bug 2 - Response shape verification
  console.log("Test: Response shape (Flattening)");
  assert.strictEqual(resDashboard.body.ok, true, "Response should have ok: true");
  assert.ok(Array.isArray(resDashboard.body.topSkills), "topSkills should be an array at root level");
  assert.ok(Array.isArray(resDashboard.body.worstSkills), "worstSkills should be an array at root level");
  assert.strictEqual(resDashboard.body.data, undefined, "Response should NOT contain nested 'data' object");
  
  // Metrics fields
  assert.notStrictEqual(resDashboard.body.cacheEfficiency, undefined, "cacheEfficiency should be at root level");
  assert.notStrictEqual(resDashboard.body.fallbackRate, undefined, "fallbackRate should be at root level");
  assert.notStrictEqual(resDashboard.body.avgLatency, undefined, "avgLatency should be at root level");

  // Verify other prefixes
  console.log("Test: Other route prefixes");
  const resExperiments = await request(app).get('/api/experiments');
  assert.notStrictEqual(resExperiments.status, 404, "GET /api/experiments should not be 404");

  const resParams = await request(app).get('/api/learning/params');
  assert.notStrictEqual(resParams.status, 404, "GET /api/learning/params should not be 404");

  console.log("✅ src/server/routes/ops.routes.test.ts passed");
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
