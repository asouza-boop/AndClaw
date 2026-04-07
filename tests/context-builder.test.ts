import assert from 'node:assert/strict';
import test from 'node:test';
import { ContextBuilder } from '@/core/ContextBuilder';

test('ContextBuilder composes prompt blocks deterministically', () => {
  const builder = new ContextBuilder();
  const prompt = builder.build({
    systemPrompt: 'Base prompt',
    profile: [
      { key: 'role', value: 'builder' },
      { key: 'fullName', value: 'Anderson' },
    ],
    semanticContext: '[MEMÓRIA SEMÂNTICA]\n1. note\n[FIM DA MEMÓRIA SEMÂNTICA]',
  });

  assert.ok(prompt.startsWith('Base prompt'));
  assert.ok(prompt.includes('[MEMÓRIA DE PERFIL DO USUÁRIO]'));
  assert.ok(prompt.indexOf('- fullName: Anderson') < prompt.indexOf('- role: builder'));
  assert.ok(prompt.includes('[MEMÓRIA SEMÂNTICA]'));
  assert.ok(prompt.endsWith('[FIM DA MEMÓRIA SEMÂNTICA]'));
});
