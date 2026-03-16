import { Bot } from 'grammy';
import { config } from './config/env';
import { TelegramInputHandler } from './telegram/TelegramInputHandler';
import { startServer } from './server';

async function bootstrap() {
    console.log("================================================");
    console.log("   🚀 Inicializando AndClaw       ");
    console.log("================================================");
    
    await startServer();

    try {
        if (!config.telegram.token || config.telegram.token === 'YOUR_TELEGRAM_BOT_TOKEN') {
            console.warn("⚠️ Telegram desativado: TOKEN inválido.");
            return;
        }

        const bot = new Bot(config.telegram.token);
        const inputHandler = new TelegramInputHandler(bot);
        
        inputHandler.startListen();

        console.log(`✅ Conectando ao Telegram...`);
        console.log(`🔒 ID Protegidos: [${config.telegram.allowedUsers.join(', ')}]`);
        
        // Start long polling
        await bot.start({
            onStart: (botInfo) => {
                console.log(`🤖 Bot iniciado com sucesso como @${botInfo.username}`);
                console.log(`🧠 Provider Ativo: ${config.llm.defaultProvider.toUpperCase()}`);
            }
        });

    } catch (e: any) {
        console.error("❌ Falha na inicialização do serviço:", e);
        process.exit(1);
    }
}

// Global exception handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
});

bootstrap();
