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
  agent: {
    userName: process.env.AGENT_USER_NAME || 'usuário',
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
  db: {
    url: process.env.DATABASE_URL || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    allowedOrigin: process.env.ALLOWED_ORIGIN || '',
  },
  google: {
    accountsJson: process.env.GOOGLE_ACCOUNTS_JSON || '[]',
    oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    oauthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || '',
    exportCalendarId: process.env.GOOGLE_EXPORT_CALENDAR_ID || 'primary',
  },
  auth: {
    password: process.env.AUTH_PASSWORD || '',
    tokenSecret: process.env.AUTH_TOKEN_SECRET || '',
  },
  gitvault: {
    repo: process.env.GITVAULT_REPO || '',
    token: process.env.GITHUB_TOKEN || '',
    basePath: process.env.GITVAULT_BASE_PATH || 'daily',
  },
  push: {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    contactEmail: process.env.VAPID_CONTACT_EMAIL || 'mailto:admin@example.com',
  },
  raindrop: {
    token: process.env.RAINDROP_TOKEN || '',
    collectionId: process.env.RAINDROP_COLLECTION_ID || '0',
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
