import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { Pool } from 'pg';
import tasksRouter from '@/server/routes/tasks.routes';
import { TaskService } from '@/core/agent/TaskService';
import { agentEvents, TASK_MUTATED } from '@/core/events/AgentEvents';
// @ts-ignore - mock injection pattern
import * as postgres from '@/db/postgres';

const app = express();
app.use(express.json());
app.use(tasksRouter);
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(err.status || 500).json({ error: err.message });
});

// Set up mock
let mockQueryFn: any = () => ({ rows: [] });
const pool = postgres.getPool();
mock.method(pool, 'query', async (text: string, params?: any[]) => {
  return mockQueryFn(text, params);
});

test('tasks.test suite', async (t) => {

  t.beforeEach(() => {
    mockQueryFn = () => ({ rows: [] });
  });

  t.after(() => {
    mock.restoreAll();
  });

  await t.test('Test 1 - POST /tasks with empty body returns 400', async () => {
    const res = await request(app).post('/tasks').send({});
    assert.equal(res.status, 400);
    assert.ok(res.body.error && res.body.error.includes('title'));
  });

  await t.test('Test 2 - POST /tasks with valid body returns 201', async () => {
    mockQueryFn = () => ({ rows: [{ id: 1, title: 'Test', status: 'todo' }] });
    const res = await request(app).post('/tasks').send({ title: 'Test task' });
    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
  });

  await t.test('Test 3 - asyncHandler propagates DB errors on GET /tasks', async () => {
    mockQueryFn = () => { throw new Error('db_failure'); };
    const res = await request(app).get('/tasks');
    assert.equal(res.status, 500);
  });

  await t.test('Test 4 - DELETE /tasks/:id returns 404 for missing task', async () => {
    mockQueryFn = () => ({ rows: [] });
    const res = await request(app).delete('/tasks/999');
    assert.equal(res.status, 404);
  });

  await t.test('Test 5 - DELETE /tasks/:id returns 200 for existing task', async () => {
    let callCount = 0;
    mockQueryFn = (text: string) => {
      callCount++;
      if (callCount === 1) return { rows: [{ id: 1, gcal_event_id: null, capture_id: null }] }; // SELECT
      return { rows: [{ id: 1 }] }; // DELETE
    };
    const res = await request(app).delete('/tasks/1');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  await t.test('Test 6 - createFromCapture() re-throws on DB failure', async () => {
    mockQueryFn = () => { throw new Error('db_failure'); };
    await assert.rejects(
      async () => TaskService.createFromCapture({ id: 1, content: 'test', type: 'task' }),
      /db_failure/
    );
  });

  await t.test('Test 7 - createFromCapture() returns without throwing for non-task type', async () => {
    const result = await TaskService.createFromCapture({ id: 1, content: 'test', type: 'note' });
    assert.equal(result, undefined);
  });

  await t.test('Test 8 - PATCH /tasks/:id emits TASK_MUTATED when due_date removed', async () => {
    mockQueryFn = () => ({ rows: [{ id: 1, title: 'Test', due_date: null, gcal_event_id: 'gcal_123' }] });
    
    let eventPayload: any;
    const listener = (payload: any) => { eventPayload = payload; };
    agentEvents.on(TASK_MUTATED, listener);

    const res = await request(app).patch('/tasks/1').send({ due_date: null });
    
    agentEvents.off(TASK_MUTATED, listener);
    
    assert.ok(eventPayload, 'TASK_MUTATED should be emitted');
    assert.equal(eventPayload.deleted, true);
    assert.equal(res.status, 200);
  });
});
