import { Bot, Context } from 'grammy';
import { AgentController } from '../core/AgentController';
import { config } from '../config/env';
import fs from 'fs';
import path from 'path';
const pdf = require('pdf-parse');
import * as XLSX from 'xlsx';

export class TelegramInputHandler {
    private bot: Bot;
    private controller: AgentController;

    constructor(bot: Bot) {
        this.bot = bot;
        this.controller = new AgentController();
    }

    public startListen() {
        // Validation Hook (Middleware)
        this.bot.use(async (ctx, next) => {
            const userId = ctx.from?.id.toString();
            if (!userId) return;

            if (!config.telegram.allowedUsers.includes(userId)) {
                console.warn(`[TelegramInput] Tentativa de acesso bloqueado do UID: ${userId}`);
                return;
            }
            await next();
        });

        // Main Text Handler
        this.bot.on('message:text', async (ctx) => {
            await this.handleInput(ctx, ctx.message.text);
        });

        // Voice and Audio Handler
        this.bot.on(['message:voice', 'message:audio'], async (ctx) => {
            const userId = ctx.from.id.toString();
            console.log(`[TelegramInput] Recebido áudio de ${userId}`);

            ctx.replyWithChatAction('record_voice').catch(console.error);
            const typingInterval = this.startTypingEffect(ctx, 'record_voice');

            try {
                const file = await ctx.getFile();
                const filePath = file.file_path;
                const url = `https://api.telegram.org/file/bot${config.telegram.token}/${filePath}`;
                
                const fileResp = await fetch(url);
                const buffer = Buffer.from(await fileResp.arrayBuffer());
                const base64Audio = buffer.toString('base64');
                const mimeType = ctx.message.voice ? 'audio/ogg' : (ctx.message.audio?.mime_type || 'audio/mpeg');

                const response = await this.controller.processInput(
                    userId, 
                    `[Mensagem de Áudio Recebida]`, 
                    { 
                        requires_audio_reply: true,
                        audioData: base64Audio,
                        mimeType: mimeType
                    }
                );
                
                clearInterval(typingInterval);
                await this.safeReply(ctx, response);

        } catch (e: any) {
            clearInterval(typingInterval);
            console.error(`[TelegramInput] Erro ao processar áudio:`, e);
            await this.safeReply(ctx, `[Sistema] Erro ao processar seu áudio: ${e.message}`);
        }
    });

    // Document Handler (PDF, MD, Excel)
    this.bot.on('message:document', async (ctx) => {
        const userId = ctx.from.id.toString();
        const doc = ctx.message.document;
        const fileName = doc.file_name || 'documento';
        
        console.log(`[TelegramInput] Recebido documento de ${userId}: ${fileName}`);

        ctx.replyWithChatAction('typing').catch(console.error);
        const typingInterval = this.startTypingEffect(ctx, 'typing');

        try {
            const file = await ctx.getFile();
            const url = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
            const response = await fetch(url);
            const buffer = Buffer.from(await response.arrayBuffer());

            let content = '';
            if (fileName.endsWith('.pdf')) {
                const data = await pdf(buffer);
                content = data.text;
            } else if (fileName.endsWith('.md') || fileName.endsWith('.txt')) {
                content = buffer.toString('utf-8');
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                content = XLSX.utils.sheet_to_csv(worksheet);
            } else {
                clearInterval(typingInterval);
                return ctx.reply("⚠️ No momento, só consigo processar texto estruturado (.md), áudio, PDF e Excel.");
            }

            const fullInput = `Arquivo: ${fileName}\nConteúdo:\n${content}\n\nLegenda: ${ctx.message.caption || ''}`;
            const result = await this.controller.processInput(userId, fullInput);
            
            clearInterval(typingInterval);
            await this.safeReply(ctx, result);

        } catch (e: any) {
            clearInterval(typingInterval);
            console.error(`[TelegramInput] Erro ao processar documento:`, e);
            await this.safeReply(ctx, `[Sistema] Erro ao processar seu documento: ${e.message}`);
        }
    });

        // Basic Info Commands
        this.bot.command('start', (ctx) => {
            const userName = process.env.AGENT_USER_NAME || 'usuário';
            ctx.reply(`👋 Olá ${userName}! Sou o AndClaw, seu agente pessoal.\nUse /ping para status ou /help para ver os comandos disponíveis.`);
        });

        this.bot.command('ping', (ctx) => {
             ctx.reply(`⚙️ AndClaw Operante.\nProvider Selecionado: ${config.llm.defaultProvider.toUpperCase()}`);
        });

        // Comando /help
        this.bot.command('help', (ctx) => {
            ctx.reply(
                `🤖 *Comandos disponíveis:*\n\n` +
                `/start — Apresentação\n` +
                `/ping — Status do agente\n` +
                `/clear — Limpar histórico da conversa\n` +
                `/skills — Listar skills carregadas\n` +
                `/provider — Ver provider LLM ativo\n` +
                `/help — Esta mensagem`,
                { parse_mode: 'Markdown' }
            );
        });

        // Comando /clear — limpa o histórico da conversa atual
        this.bot.command('clear', async (ctx) => {
            const userId = ctx.from?.id.toString();
            if (!userId) return;
            try {
                await this.controller.clearHistory(userId);
                ctx.reply('🗑️ Histórico limpo. Começando uma nova conversa.');
            } catch (e: any) {
                ctx.reply(`Erro ao limpar histórico: ${e.message}`);
            }
        });

        // Comando /skills — lista as skills carregadas
        this.bot.command('skills', (ctx) => {
            const skills = this.controller.getLoadedSkills();
            if (skills.length === 0) {
                return ctx.reply('Nenhuma skill carregada no momento.');
            }
            const list = skills.map(s => `• *${s.metadata.name}*: ${s.metadata.description}`).join('\n');
            ctx.reply(`⚡ *Skills ativas (${skills.length}):*\n\n${list}`, { parse_mode: 'Markdown' });
        });

        // Comando /provider — mostra provider ativo e chain configurada
        this.bot.command('provider', (ctx) => {
            const chain = config.llm.providerChain.join(' → ');
            ctx.reply(
                `🧠 *Provider ativo:* ${config.llm.defaultProvider.toUpperCase()}\n` +
                `🔗 *Chain de fallback:* ${chain}`,
                { parse_mode: 'Markdown' }
            );
        });

        // Error Handler
        this.bot.catch((err) => {
            console.error(`[Telegram Global Error]:`, err);
        });
    }

    private async handleInput(ctx: Context, text: string) {
        const userId = ctx.from?.id.toString();
        if (!userId) return;

        // Limite de 4000 caracteres por mensagem
        const MAX_INPUT_LENGTH = 4000;
        if (text.length > MAX_INPUT_LENGTH) {
            return ctx.reply(
                `⚠️ Mensagem muito longa (${text.length} chars). ` +
                `Limite: ${MAX_INPUT_LENGTH} caracteres. ` +
                `Tente dividir em partes menores.`
            );
        }

        console.log(`[TelegramInput] Recebido de ${userId}: ${text.substring(0, 100)}...`);

        ctx.replyWithChatAction('typing').catch(console.error);
        const typingInterval = this.startTypingEffect(ctx, 'typing');

        try {
            const response = await this.controller.processInput(userId, text);
            clearInterval(typingInterval);
            await this.safeReply(ctx, response);
        } catch (e: any) {
            clearInterval(typingInterval);
            console.error(`[TelegramInput] Erro ao processar mensagem:`, e);
            await this.safeReply(ctx, `[Sistema] Ocorreu um erro interno: ${e.message}`);
        }
    }

    private startTypingEffect(ctx: Context, action: 'typing' | 'record_voice' = 'typing') {
        return setInterval(() => {
            ctx.replyWithChatAction(action).catch(console.error);
        }, 4000);
    }

    /**
     * Tries to send a Markdown message. If Telegram rejects it (bad entities),
     * retries as plain text — no more 400 crashes from error messages with JSON.
     */
    private async safeReply(ctx: Context, text: string): Promise<void> {
        if (!text || text.trim().length === 0) {
            console.warn('[TelegramInput] Tentativa de enviar mensagem vazia. Ignorando.');
            return;
        }

        try {
            await ctx.reply(text, { parse_mode: 'Markdown' });
        } catch (e: any) {
            // Em caso de QUALQUER erro (Markdown, rede, etc), tenta texto plano.
            console.warn('[TelegramInput] Falha no reply (Markdown), tentando texto plano:', e.message);
            try {
                // Remove caracteres que costumam quebrar o Markdown apenas para garantir
                const safeText = text.replace(/[*_`]/g, '');
                await ctx.reply(safeText);
            } catch (innerError: any) {
                console.error('[TelegramInput] Falha crítica ao enviar resposta final:', innerError.message);
            }
        }
    }
}
