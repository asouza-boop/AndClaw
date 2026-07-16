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
        logger.error('bootstrap.init_failed', {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        });
        process.exit(1);
    }
}

// Global exception handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('process.unhandled_rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
});

bootstrap();
