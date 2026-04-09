import { ToolRegistry } from './src/core/ToolRegistry';
import { ExecutionOrchestrator } from './src/core/execution/ExecutionOrchestrator';

async function testOrchestrator() {
    const registry = new ToolRegistry();
    // Simulate adding a mock tool
    registry.getAllTools = () => [{ 
        name: 'mock-tool', 
        description: 'mock', 
        parameters: {},
        execute: async (args) => {
            if (args.fail) {
                throw new Error("Simulated failure!");
            }
            return `Mock executed with ${JSON.stringify(args)}`;
        }
    }];
    
    registry.getTool = (name) => registry.getAllTools().find(t => t.name === name);

    const orchestrator = new ExecutionOrchestrator(registry);

    console.log('\n--- 1. Testing Safe Execution ---');
    const safeSteps = [{ name: 'mock-tool', arguments: { fail: false } }];
    let results = await orchestrator.executeSteps(safeSteps);
    console.log('Result:', results);

    console.log('\n--- 2. Testing Retry Mechanism on Failure ---');
    const failSteps = [{ name: 'mock-tool', arguments: { fail: true } }];
    results = await orchestrator.executeSteps(failSteps);
    console.log('Result:', results);

    console.log('\n--- 3. Testing Security Blocking ---');
    const secureSteps = [{ name: 'mock-tool', arguments: { cmd: 'npm i suspicious<script>' } }];
    try {
        await orchestrator.executeSteps(secureSteps);
    } catch (e: any) {
        console.log('Orchestrator correctly threw a security error:', e.message);
    }
}

testOrchestrator().catch(console.error);
