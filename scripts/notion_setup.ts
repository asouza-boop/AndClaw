import { Client } from '@notionhq/client';
import { config } from '../src/config/env';
import dotenv from 'dotenv';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const parentPageId = process.env.NOTION_PAGE_ID;

async function setup() {
    if (!parentPageId) {
        console.error("ERRO: NOTION_PAGE_ID não encontrado no .env");
        return;
    }

    console.log("🚀 Iniciando criação do AndClaw Hub no Notion...");

    try {
        // 1. Criar a página mestre
        const hubPage = await notion.pages.create({
            parent: { page_id: parentPageId },
            properties: {
                title: [{ text: { content: "🧠 AndClaw Hub" } }]
            },
            icon: { emoji: "🧠" }
        });

        console.log(`✅ Hub criado: ${hubPage.id}`);

        // 2. Criar Database de Agentes
        const agentsDb = await notion.databases.create({
            parent: { page_id: hubPage.id },
            title: [{ text: { content: "🤖 Equipe de Agentes" } }],
            properties: {
                "Nome": { title: {} },
                "Nível": { select: { options: [{ name: "Estratégico", color: "purple" }, { name: "Tático", color: "blue" }, { name: "Operacional", color: "green" }] } },
                "Status": { select: { options: [{ name: "Ativo", color: "green" }, { name: "Desenvolvimento", color: "yellow" }, { name: "Inativo", color: "gray" }] } },
                "Skill Principal": { rich_text: {} }
            }
        });
        console.log(`✅ Database de Agentes criado.`);

        // 3. Criar Database Daily Planner
        const plannerDb = await notion.databases.create({
            parent: { page_id: hubPage.id },
            title: [{ text: { content: "📅 Daily Planner" } }],
            properties: {
                "Tarefa": { title: {} },
                "Prioridade": { select: { options: [{ name: "Alta", color: "red" }, { name: "Média", color: "orange" }, { name: "Baixa", color: "blue" }] } },
                "Status": { status: {} },
                "Data": { date: {} }
            }
        });
        console.log(`✅ Database Daily Planner criado.`);

        // 4. Criar Database de Transcrições
        const transcDb = await notion.databases.create({
            parent: { page_id: hubPage.id },
            title: [{ text: { content: "🎙️ Transcrições & Insights" } }],
            properties: {
                "Título": { title: {} },
                "Data": { date: {} },
                "Tags": { multi_select: {} },
                "Original URL": { url: {} }
            }
        });
        console.log(`✅ Database de Transcrições criado.`);

        console.log("\n--- CONFIGURAÇÕES PARA O .env ---");
        console.log(`NOTION_HUB_PAGE_ID=${hubPage.id}`);
        console.log(`NOTION_AGENTS_DB_ID=${agentsDb.id}`);
        console.log(`NOTION_PLANNER_DB_ID=${plannerDb.id}`);
        console.log(`NOTION_INSIGHTS_DB_ID=${transcDb.id}`);

    } catch (error: any) {
        console.error("❌ Erro ao configurar Notion:", error.message);
    }
}

setup();
