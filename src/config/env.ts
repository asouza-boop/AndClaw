import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedUsers: (process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map(id => id.trim()),
  },
  llm: {
    geminiKey: process.env.GEMINI_API_KEY || '',
    geminiKey2: process.env.GEMINI_API_KEY_2 || '',
    geminiKey3: process.env.GEMINI_API_KEY_3 || '',
    deepseekKey: process.env.DEEPSEEK_API_KEY || '',
    openrouterKey: process.env.OPENROUTER_API_KEY || '',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
    defaultProvider: process.env.DEFAULT_LLM_PROVIDER || 'gemini',
    providerChain: (process.env.LLM_PROVIDER_CHAIN || 'gemini-flash,gemini-flash-lite,openrouter,deepseek').split(',').map(p => p.trim()),
    maxIterations: parseInt(process.env.MAX_ITERATIONS || '5', 10),
  },
  paths: {
    db: path.join(process.cwd(), 'data', 'db.sqlite'),
    skills: path.join(process.cwd(), '.agents', 'skills'),
    tmp: path.join(process.cwd(), 'tmp'),
  }
};

// Validate critical variables
if (!config.telegram.token) {
  console.warn('WARNING: TELEGRAM_BOT_TOKEN is not set in environment variables.');
}

if (config.telegram.allowedUsers.length === 0 || config.telegram.allowedUsers[0] === '') {
  console.warn('WARNING: TELEGRAM_ALLOWED_USER_IDS is not set. Bot will reject all users.');
}
