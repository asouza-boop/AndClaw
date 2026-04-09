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

    const loop = new AgentLoop("mock", registry);
    console.log("--- Executing Test Loop (Success) ---");
    await loop.run("system", [], "test safe");

    // Restore provider
    ProviderFactory.getChain = originalProvider;
}

testMetrics().catch(console.error);
