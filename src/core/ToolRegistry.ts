export interface Initializer {
    execute(args: any): Promise<string>;
}

export interface ITool {
    name: string;
    description: string;
    parameters: any; // JSON Schema for arguments
    execute(args: any): Promise<string>;
}

export class ToolRegistry {
    private tools: Map<string, ITool> = new Map();

    constructor() {
        // Register default base tools
        this.registerTool(new FileSystemReadTool());
        this.registerTool(new FileSystemWriteTool());
    }

    public registerTool(tool: ITool) {
        this.tools.set(tool.name, tool);
    }

    public getTool(name: string): ITool | undefined {
        return this.tools.get(name);
    }

    public getAllTools(): ITool[] {
        return Array.from(this.tools.values());
    }
}

// Minimal implementation of default tools for the Agent Loop tests
import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

class FileSystemReadTool implements ITool {
    name = "read_file";
    description = "Lê o conteúdo de um arquivo baseado no caminho (path).";
    parameters = {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"]
    };
    
    async execute({ path: filePath }: { path: string }): Promise<string> {
        try {
            return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');
        } catch (e: any) {
            return `Erro ao ler arquivo: ${e.message}`;
        }
    }
}

class FileSystemWriteTool implements ITool {
    name = "write_file";
    description = "Escreve ou sobrescreve conteúdo em um arquivo. Útil para gerar scripts e respostas.";
    parameters = {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"]
    };
    
    async execute({ path: filePath, content }: { path: string, content: string }): Promise<string> {
        try {
            const absolute = path.resolve(process.cwd(), filePath);
            fs.mkdirSync(path.dirname(absolute), { recursive: true });
            fs.writeFileSync(absolute, content, 'utf-8');
            return `Arquivo salvo com sucesso em ${absolute}`;
        } catch (e: any) {
            return `Erro ao escrever arquivo: ${e.message}`;
        }
    }
}
