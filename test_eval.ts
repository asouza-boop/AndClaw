import { AgentLoop } from './src/core/AgentLoop';
import { ToolRegistry } from './src/core/ToolRegistry';
import { ProviderFactory } from './src/providers/ProviderFactory';

// This is a minimal mock to simulate testing in AgentLoop to ensure metrics are produced.
async function testMetrics() {
    const registry = new ToolRegistry();
    // Simulate overriding provider for direct testing
    const originalProvider = ProviderFactory.getChain;
    ProviderFactory.getChain = () => ({
        generateResponse: async () => ({
            text: "Mock response text",
            toolCalls: []
        }),
        initialize: async () => {}
    } as any);

    const originalFetch = global.fetch;
    process.env.EMBEDDING_API_KEY = 'mock';
    global.fetch = async () => ({
        ok: true,
        json: async () => ({ data: [{ embedding: new Array(1536).fill(0.1) }] })
    }) as any;

    const loop = new AgentLoop("mock", registry);
    console.log("--- Executing Test Loop (Success) ---");
    await loop.run("system", [], "test safe");

    // Restore provider
    ProviderFactory.getChain = originalProvider;
    global.fetch = originalFetch;
}

testMetrics().catch(console.error);
