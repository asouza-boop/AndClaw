import { Bot } from 'grammy';
import { config } from './config/env';
import { TelegramInputHandler } from './telegram/TelegramInputHandler';
import { startServer } from './server';
import { logger } from '@/infra/logger';

async function bootstrap() {
    logger.info("================================================");
    logger.info("   🚀 Inicializando AndClaw       ");
    logger.info("================================================");
    
    await startServer();

    try {
        if (!config.telegram.token || config.telegram.token === 'YOUR_TELEGRAM_BOT_TOKEN') {
            logger.warn("⚠️ Telegram desativado: TOKEN inválido.");
            return;
        }

        const bot = new Bot(config.telegram.token);
        const inputHandler = new TelegramInputHandler(bot);
        
        inputHandler.startListen();

        logger.info(`✅ Conectando ao Telegram...`);
        logger.info(`🔒 ID Protegidos: [${config.telegram.allowedUsers.join(', ')}]`);
        
        // Start long polling
        await bot.start({
            onStart: (botInfo) => {
                logger.info(`🤖 Bot iniciado com sucesso como @${botInfo.username}`);
                logger.info(`🧠 Provider Ativo: ${config.llm.defaultProvider.toUpperCase()}`);
            }
        });

    } catch (e: any) {
        logger.error("❌ Falha na inicialização do serviço:", e as any);
        process.exit(1);
    }
}

// Global exception handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Unhandled Rejection]', reason as any);
});

process.on('uncaughtException', (error) => {
  logger.error('[Uncaught Exception]', error as any);
});

bootstrap();
