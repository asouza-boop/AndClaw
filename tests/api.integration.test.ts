import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import { config as globalConfig } from '@/config/env';
import { attachRequestContext } from '@/server/http';
import { errorHandler } from '@/server/error-handler';
import { authMiddleware, issueToken } from '@/server/auth';
import { createAuthRoutes } from '@/server/auth-routes';
import { createAgentRoutes } from '@/server/agent-routes';
import { createMemoryRoutes } from '@/server/memory-routes';
import { createToolRoutes } from '@/server/tool-routes';
import { ToolRegistry } from '@/core/ToolRegistry';
import { Tool } from '@/modules/tools/Tool';
import { z } from 'zod';

class EchoTool implements Tool {
  name = 'echo';
  description = 'Echo tool for API integration testing.';
  parameters = { type: 'object' };
  inputSchema = z.object({ message: z.string().min(1) });

  async execute(args: { message: string }): Promise<string> {
    return `echo:${args.message}`;
  }
}

function createBaseConfig() {
  return {
    env: 'test',
    telegram: { token: '', allowedUsers: [] },
    agent: { userName: 'usuário' },
    llm: {
      geminiKey: 'gemini-key',
      geminiKey2: '',
      geminiKey3: '',
      deepseekKey: '',
      openrouterKey: '',
      ollamaModel: 'llama3.2',
      defaultProvider: 'gemini',
      providerChain: ['gemini'],
      maxIterations: 2,
    },
    db: { url: '' },
    server: { port: 3000, allowedOrigin: '', frontendUrl: '' },
    google: {
      accountsJson: '[]',
      oauthClientId: 'google-client',
      oauthClientSecret: 'google-secret',
      oauthRedirectUri: 'http://localhost/auth/callback',
      exportCalendarId: 'primary',
      calendarSyncInterval: 30,
    },
    auth: { password: 'hash:secret-123', tokenSecret: 'integration-secret' },
    gitvault: { repo: 'owner/repo', token: 'github-token', basePath: 'daily' },
    push: { vapidPublicKey: 'pub', vapidPrivateKey: 'priv', contactEmail: 'mailto:test@example.com' },
    raindrop: { token: 'raindrop-token', collectionId: '42' },
    paths: { db: '', skills: '', tmp: '' },
  } as any;
}

function createMemoryQuery() {
  const items: any[] = [];
  return {
    items,
    query: async (sql: string, params: any[] = []) => {
      if (sql.includes('INSERT INTO memory_items')) {
        const [type, content, source_type, source_id] = params;
        const row = {
          id: items.length + 1,
          type,
          content,
          source_type,
          source_id,
          created_at: new Date().toISOString(),
        };
        items.unshift(row);
        return [row];
      }
      if (sql.includes('SELECT * FROM memory_items')) {
        return items;
      }
      return [];
    },
  };
}

test('API routes validate inputs, authorize requests and stay observable', async () => {
  const originalAuth = { ...globalConfig.auth };
  const originalLlm = { ...globalConfig.llm };
  globalConfig.auth.password = 'hash:secret-123';
  globalConfig.auth.tokenSecret = 'integration-secret';
  globalConfig.llm.geminiKey = 'gemini-key';
  globalConfig.llm.deepseekKey = '';
  globalConfig.llm.openrouterKey = '';

  const memoryStore = createMemoryQuery();
  const registry = new ToolRegistry();
  registry.registerTool(new EchoTool());
  const token = issueToken('andclaw-user');

  const app = express();
  app.use(express.json());
  app.use(attachRequestContext);
  app.use('/api/auth', createAuthRoutes({
    config: globalConfig as any,
    query: async () => [],
    issueToken: () => token,
    verifyLoginPassword: (password: string) => password === 'secret-123',
    loadAuthFromDb: async () => {},
    setSetting: async () => {},
    hashPassword: (value: string) => `hash:${value}`,
    randomSecret: () => 'integration-secret',
  } as any));
  app.use('/api', authMiddleware);
  app.use('/api', createAgentRoutes({
    config: globalConfig as any,
    getUserId: (req) => (req as any).user?.sub || 'pwa-user',
    hasLLMConfig: () => true,
    offlineFallbackMessage: () => 'offline',
    processInput: async (_userId, input) => `reply:${input}`,
  } as any));
  app.use('/api', createMemoryRoutes({ query: memoryStore.query as any }));
  app.use('/api', createToolRoutes({ registry } as any));
  app.use(errorHandler);

  try {
    const unauthorized = await request(app).post('/api/agent/run').send({ input: 'ping' });
    assert.equal(unauthorized.status, 401);

    const invalidRun = await request(app)
      .post('/api/agent/run')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assert.equal(invalidRun.status, 400);
    assert.equal(invalidRun.body.error.code, 'invalid_request');
    assert.ok(invalidRun.body.requestId);

    const validRun = await request(app)
      .post('/api/agent/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ input: 'ping' });
    assert.equal(validRun.status, 200);
    assert.equal(validRun.body.reply, 'reply:ping');

    const invalidMemory = await request(app)
      .post('/api/memory')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assert.equal(invalidMemory.status, 400);

    const memoryCreate = await request(app)
      .post('/api/memory')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'note', content: 'hello memory' });
    assert.equal(memoryCreate.status, 200);
    assert.equal(memoryCreate.body.item.content, 'hello memory');

    const memoryList = await request(app)
      .get('/api/memory')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(memoryList.status, 200);
    assert.equal(memoryList.body.items.length, 1);

    const toolsList = await request(app)
      .get('/api/tools')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(toolsList.status, 200);
    assert.ok(toolsList.body.items.some((tool: any) => tool.name === 'echo'));

    const invalidTool = await request(app)
      .post('/api/tools/echo')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assert.equal(invalidTool.status, 400);

    const validTool = await request(app)
      .post('/api/tools/echo')
      .set('Authorization', `Bearer ${token}`)
      .send({ arguments: { message: 'hello' } });
    assert.equal(validTool.status, 200);
    assert.equal(validTool.body.output, 'echo:hello');
  } finally {
    globalConfig.auth.password = originalAuth.password;
    globalConfig.auth.tokenSecret = originalAuth.tokenSecret;
    globalConfig.llm.geminiKey = originalLlm.geminiKey;
    globalConfig.llm.deepseekKey = originalLlm.deepseekKey;
    globalConfig.llm.openrouterKey = originalLlm.openrouterKey;
  }
});

