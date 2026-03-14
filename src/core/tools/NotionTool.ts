import { ITool } from '../ToolRegistry';
import { config } from '../../config/env';

export class NotionTool implements ITool {
    name = "notion_api";
    description = "Interage com o Notion para criar páginas, listar bancos de dados ou atualizar conteúdo.";
    parameters = {
        type: "object",
        properties: {
            action: { 
                type: "string", 
                enum: ["create_page", "append_block", "list_pages"], 
                description: "Ação a ser executada no Notion" 
            },
            title: { type: "string", description: "Título da página ou conteúdo" },
            content: { type: "string", description: "Conteúdo do bloco ou corpo da página" },
            parentId: { type: "string", description: "ID da página pai (opcional, usa o padrão do .env se não fornecido)" }
        },
        required: ["action"]
    };

    private async callNotion(path: string, method: string, body: any) {
        const apiKey = process.env.NOTION_API_KEY;
        if (!apiKey) throw new Error("NOTION_API_KEY não configurada no .env");

        const response = await fetch(`https://api.notion.com/v1${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Notion API Error: ${JSON.stringify(error)}`);
        }

        return await response.json();
    }

    async execute(args: any): Promise<string> {
        const { action, title, content, parentId } = args;
        const targetParent = parentId || process.env.NOTION_PAGE_ID;

        try {
            if (action === "create_page") {
                if (!targetParent) throw new Error("Parent ID não fornecido e não configurado no .env");
                const result = await this.callNotion('/pages', 'POST', {
                    parent: { page_id: targetParent },
                    properties: {
                        title: [{ text: { content: title || "Nova Página" } }]
                    },
                    children: [
                        {
                            object: 'block',
                            type: 'paragraph',
                            paragraph: {
                                rich_text: [{ text: { content: content || "Conteúdo gerado pelo AndClaw." } }]
                            }
                        }
                    ]
                });
                return `Página criada com sucesso no Notion: ${result.url}`;
            }

            if (action === "append_block") {
                const result = await this.callNotion(`/blocks/${targetParent}/children`, 'PATCH', {
                    children: [
                        {
                            object: 'block',
                            type: 'heading_2',
                            heading_2: { rich_text: [{ text: { content: title || "Insight" } }] }
                        },
                        {
                            object: 'block',
                            type: 'paragraph',
                            paragraph: { rich_text: [{ text: { content: content } }] }
                        }
                    ]
                });
                return `Conteúdo adicionado ao Notion com sucesso.`;
            }

            return `Ação '${action}' ainda não implementada com detalhes completos.`;
        } catch (e: any) {
            return `Falha no Notion: ${e.message}`;
        }
    }
}
