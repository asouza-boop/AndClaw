export interface Initializer {
    execute(args: any): Promise<string>;
}

export interface ITool {
    name: string;
    description: string;
    parameters: any; // JSON Schema for arguments
    execute(args: any): Promise<string>;
}

import { UpdateProfileTool, DeleteProfileTool } from './tools/ProfileTool';
import { NotionTool } from './tools/NotionTool';

export class ToolRegistry {
    private tools: Map<string, ITool> = new Map();

    constructor() {
        // Register default base tools
        this.registerTool(new FileSystemReadTool());
        this.registerTool(new FileSystemWriteTool());
        this.registerTool(new LSTool());
        this.registerTool(new GlobTool());
        this.registerTool(new GrepTool());
        
        // Register Memory & Integration tools
        this.registerTool(new UpdateProfileTool());
        this.registerTool(new DeleteProfileTool());
        this.registerTool(new NotionTool());
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
import { glob } from 'glob';
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

class LSTool implements ITool {
    name = "ls";
    description = "Lista o conteúdo de um diretório.";
    parameters = {
        type: "object",
        properties: { 
            path: { type: "string", description: "Caminho do diretório (padrão: .)" } 
        }
    };

    async execute({ path: dirPath = "." }: { path?: string }): Promise<string> {
        try {
            const absolute = path.resolve(process.cwd(), dirPath);
            const files = fs.readdirSync(absolute);
            return files.join('\n');
        } catch (e: any) {
            return `Erro ao listar diretório: ${e.message}`;
        }
    }
}

class GlobTool implements ITool {
    name = "glob";
    description = "Busca arquivos usando padrões glob (ex: **/*.ts).";
    parameters = {
        type: "object",
        properties: { 
            pattern: { type: "string", description: "Padrão de busca" } 
        },
        required: ["pattern"]
    };

    async execute({ pattern }: { pattern: string }): Promise<string> {
        try {
            const matches = await glob(pattern, { cwd: process.cwd(), nodir: true });
            return matches.join('\n');
        } catch (e: any) {
            return `Erro ao executar glob: ${e.message}`;
        }
    }
}

class GrepTool implements ITool {
    name = "grep";
    description = "Procura por um padrão de texto dentro de arquivos.";
    parameters = {
        type: "object",
        properties: { 
            pattern: { type: "string", description: "Regex ou texto de busca" },
            path: { type: "string", description: "Arquivo ou diretório de busca" }
        },
        required: ["pattern", "path"]
    };

    async execute({ pattern, path: searchPath }: { pattern: string, path: string }): Promise<string> {
        try {
            const absolute = path.resolve(process.cwd(), searchPath);
            const regex = new RegExp(pattern, 'i');
            const results: string[] = [];

            const searchInFile = (filePath: string) => {
                try {
                    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
                    lines.forEach((line, i) => {
                        if (regex.test(line)) {
                            results.push(`${filePath}:${i + 1}: ${line.trim()}`);
                        }
                    });
                } catch { /* ignora arquivos binários ou sem permissão */ }
            };

            const walk = (dir: string) => {
                if (results.length >= 20) return;
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (results.length >= 20) break;
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
                        walk(full);
                    } else if (entry.isFile()) {
                        searchInFile(full);
                    }
                }
            };

            const stat = fs.statSync(absolute);
            if (stat.isDirectory()) {
                walk(absolute);
            } else {
                searchInFile(absolute);
            }

            return results.length > 0 ? results.join('\n') : 'Nenhum resultado encontrado.';
        } catch (e: any) {
            return `Erro ao executar grep: ${e.message}`;
        }
    }
}
