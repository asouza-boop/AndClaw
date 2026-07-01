import assert from 'assert';
import { LLMProviderManager } from './LLMProviderManager';
import { ProviderFactory } from '@/providers/ProviderFactory';

async function main() {
  const originalList = LLMProviderManager.listEnabledProviders;
  const originalGetProvider = ProviderFactory.getProvider;

  try {
    const calls: string[] = [];
    (ProviderFactory as any).getProvider = (name: string) => ({
      model: name,
      initialize: async () => undefined,
      generateResponse: async () => {
        calls.push(name);
        if (name === 'alpha' || name === 'beta') {
          throw new Error(`fail-${name}`);
        }
        return { text: 'ok', providerUsed: name };
      },
    });

    (LLMProviderManager as any).listEnabledProviders = async () => ([
      { id: '1', name: 'alpha', api_key: null, base_url: null, model: 'm1', priority: 3, enabled: true },
      { id: '2', name: 'beta', api_key: null, base_url: null, model: 'm2', priority: 2, enabled: true },
      { id: '3', name: 'gamma', api_key: null, base_url: null, model: 'm3', priority: 1, enabled: true },
    ]);

    const result = await LLMProviderManager.executeWithFallback('sys', [], [], {} as any);
    assert.deepStrictEqual(calls, ['alpha', 'beta', 'gamma']);
    assert.strictEqual(result.providerUsed, 'gamma');
    assert.strictEqual(result.response.text, 'ok');
    console.log('✅ LLMProviderManager fallback test passed');
  } finally {
    (LLMProviderManager as any).listEnabledProviders = originalList;
    (ProviderFactory as any).getProvider = originalGetProvider;
  }
}

main().catch((error) => {
  console.error('❌ LLMProviderManager test failed:', error);
  process.exit(1);
});
