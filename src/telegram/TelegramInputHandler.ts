import { Bot, Context } from 'grammy';
import { AgentController } from '@/core/AgentController';
import { config } from '@/config/env';
import { sanitizeMarkdownV2 } from '@/lib/telegramMarkdown';
import fs from 'fs';
import path from 'path';
const pdf = require('pdf-parse');
import * as XLSX from 'xlsx';
import { logger } from '@/infra/logger';

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
                logger.warn(`[TelegramInput] Tentativa de acesso bloqueado do UID: ${userId}`);
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
            logger.info(`[TelegramInput] Recebido áudio de ${userId}`);

            ctx.replyWithChatAction('record_voice').catch((e) =>
              logger.error('telegram.chat_action_failed', {
                error: e instanceof Error ? e.message : String(e),
              })
            );
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
                
                await this.safeReply(ctx, response);
            } catch (e: any) {
                logger.error('telegram.audio.process_failed', {
                  error: e instanceof Error ? e.message : String(e),
                  stack: e instanceof Error ? e.stack : undefined,
                });
                await this.safeReply(ctx, `[Sistema] Erro ao processar seu áudio: ${e.message}`);
            } finally {
                clearInterval(typingInterval);
            }
    });

    // Document Handler (PDF, MD, Excel)
    this.bot.on('message:document', async (ctx) => {
        const userId = ctx.from.id.toString();
        const doc = ctx.message.document;
        const fileName = doc.file_name || 'documento';
        
        ctx.replyWithChatAction('typing').catch((e) =>
          logger.error('telegram.chat_action_failed', {
            error: e instanceof Error ? e.message : String(e),
          })
        );
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
                return ctx.reply("⚠️ No momento, só consigo processar texto estruturado (.md), áudio, PDF e Excel.");
            }

            const fullInput = `Arquivo: ${fileName}\nConteúdo:\n${content}\n\nLegenda: ${ctx.message.caption || ''}`;
            const result = await this.controller.processInput(userId, fullInput);
            
            await this.safeReply(ctx, result);
        } catch (e: any) {
            logger.error('telegram.document.process_failed', {
              error: e instanceof Error ? e.message : String(e),
              stack: e instanceof Error ? e.stack : undefined,
            });
            await this.safeReply(ctx, `[Sistema] Erro ao processar seu documento: ${e.message}`);
        } finally {
            clearInterval(typingInterval);
        }
    });

        // Basic Info Commands
        this.bot.command('start', (ctx) => {
            const userName = process.env.AGENT_USER_NAME || 'usuário';
            ctx.reply(sanitizeMarkdownV2(`👋 Olá ${userName}! Sou o AndClaw, seu agente pessoal.\nUse /ping para status ou /help para ver os comandos disponíveis.`), { parse_mode: 'MarkdownV2' });
        });

        this.bot.command('ping', (ctx) => {
             ctx.reply(`⚙️ AndClaw Operante.\nProvider Selecionado: ${config.llm.defaultProvider.toUpperCase()}`);
        });

        // Comando /help
        this.bot.command('help', (ctx) => {
            ctx.reply(
                sanitizeMarkdownV2(
                    `🤖 *Comandos disponíveis:*\n\n` +
                    `/start — Apresentação\n` +
                    `/ping — Status do agente\n` +
                    `/clear — Limpar histórico da conversa\n` +
                    `/skills — Listar skills carregadas\n` +
                    `/provider — Ver provider LLM ativo\n` +
                    `/help — Esta mensagem`
                ),
                { parse_mode: 'MarkdownV2' }
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
            ctx.reply(sanitizeMarkdownV2(`⚡ *Skills ativas (${skills.length}):*\n\n${list}`), { parse_mode: 'MarkdownV2' });
        });

        // Comando /provider — mostra provider ativo e chain configurada
        this.bot.command('provider', (ctx) => {
            const chain = config.llm.providerChain.join(' → ');
            ctx.reply(
                sanitizeMarkdownV2(
                    `🧠 *Provider ativo:* ${config.llm.defaultProvider.toUpperCase()}\n` +
                    `🔗 *Chain de fallback:* ${chain}`
                ),
                { parse_mode: 'MarkdownV2' }
            );
        });

        // Error Handler
        this.bot.catch((err) => {
            logger.error('telegram.global_error', {
              error: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            });
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

        logger.info(`[TelegramInput] Recebido de ${userId}: ${text.substring(0, 100)}...`);

        ctx.replyWithChatAction('typing').catch((e) =>
          logger.error('telegram.chat_action_failed', {
            error: e instanceof Error ? e.message : String(e),
          })
        );
        const typingInterval = this.startTypingEffect(ctx, 'typing');

        try {
            const response = await this.controller.processInput(userId, text);
            await this.safeReply(ctx, response);
        } catch (e: any) {
            logger.error('telegram.message.process_failed', {
              error: e instanceof Error ? e.message : String(e),
              stack: e instanceof Error ? e.stack : undefined,
            });
            await this.safeReply(ctx, `[Sistema] Ocorreu um erro interno: ${e.message}`);
        } finally {
            clearInterval(typingInterval);
        }
    }

    private startTypingEffect(ctx: Context, action: 'typing' | 'record_voice' = 'typing') {
        return setInterval(() => {
            ctx.replyWithChatAction(action).catch((e) =>
              logger.error('telegram.chat_action_failed', {
                error: e instanceof Error ? e.message : String(e),
              })
            );
        }, 4000);
    }

    /**
     * Tries to send a Markdown message. If Telegram rejects it (bad entities),
     * retries as plain text — no more 400 crashes from error messages with JSON.
     */
    private async safeReply(ctx: Context, text: string): Promise<void> {
        if (!text || text.trim().length === 0) {
            logger.warn('[TelegramInput] Tentativa de enviar mensagem vazia. Ignorando.');
            return;
        }

        try {
            // Using MarkdownV2 with sanitizer for reliable formatting
            await ctx.reply(sanitizeMarkdownV2(text), { parse_mode: 'MarkdownV2' });
        } catch (e: any) {
            // Fallback is no longer needed with the sanitizer, but keeping a simple log just in case
            logger.error('telegram.safe_reply.markdown_failed', {
              error: e instanceof Error ? e.message : String(e),
            });
            // If even sanitizer fails, send as plain text
            try {
                await ctx.reply(text);
            } catch (innerError: any) {
                logger.error('telegram.safe_reply.plain_failed', {
                  error: innerError instanceof Error ? innerError.message : String(innerError),
                });
            }
        }
    }
}
