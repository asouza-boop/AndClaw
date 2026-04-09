import { ProfileRepository } from './src/memory/repositories/ProfileRepository';
import { AgentLoop } from './src/core/AgentLoop';
import { ToolRegistry } from './src/core/ToolRegistry';

async function test() {
    const repo = new ProfileRepository();
    const registry = new ToolRegistry();
    const loop = new AgentLoop("gemini", registry);

    console.log("--- Teste: Persistência de Perfil ---");
    repo.set("linguagem_favorita", "TypeScript");
    repo.set("objetivo", "Automatizar Notion");
    
    const profile = repo.getAll();
    console.log("Perfil no banco:", profile);

    console.log("\n--- Teste: Injeção no Prompt ---");
    // Simulando a execução do loop para ver o prompt injetado (via log mental ou dump se possível)
    // Como o AgentLoop.run é complexo, vamos apenas testar a lógica de construção do prompt se tivéssemos acesso aos métodos privados,
    // mas aqui vamos confiar na implementação do run() que já revisamos.
    
    const result = await loop.run("Você é um assistente útil.", [], "Quem sou eu?");
    console.log("Resposta do Agente (deve refletir o perfil se o LLM for esperto):", result);
}

test().catch(console.error);
