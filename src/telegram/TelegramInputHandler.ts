import { Bot } from 'grammy';
import { AgentController } from '../core/AgentController';
import { config } from '../config/env';

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
                // Ignora silenciosamente, sem consumir tokens com respostas
                return;
            }
            await next();
        });

        // Main Text Handler
        this.bot.on('message:text', async (ctx) => {
            const userId = ctx.from.id.toString();
            const text = ctx.message.text;

            console.log(`[TelegramInput] Recebido de ${userId}: ${text}`);

            // Set typing chat action
            ctx.replyWithChatAction('typing').catch(console.error);
            const typingInterval = setInterval(() => {
                ctx.replyWithChatAction('typing').catch(console.error);
            }, 4000); // Telegram requires chat actions to be sent every 5s max

            try {
               const response = await this.controller.processInput(userId, text);
               
               clearInterval(typingInterval);
               await ctx.reply(response, { parse_mode: 'Markdown' });

            } catch (e: any) {
               clearInterval(typingInterval);
               console.error(`[TelegramInput] Erro ao processar mensagem:`, e);
               await ctx.reply(`[Sistema] Ocorreu um erro interno ao processar seu comando: ${e.message}`);
            }
        });

        // Basic Info Commmands
        this.bot.command('start', (ctx) => {
            ctx.reply(`👋 Olá Sandeco! Sou o AndClaw, seu agente local.\nUse /ping para status.`);
        });

        this.bot.command('ping', (ctx) => {
             ctx.reply(`⚙️ AndClaw Operante.\nProvider Selecionado: ${config.llm.defaultProvider.toUpperCase()}`);
        });

        // Error Handler
        this.bot.catch((err) => {
            console.error(`[Telegram Global Error]:`, err);
        });
    }
}
