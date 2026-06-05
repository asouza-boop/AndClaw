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
    providerChain: (process.env.LLM_PROVIDER_CHAIN || 'gemini-flash,gemini-flash-key2,gemini-flash-key3,gemini-flash-lite,openrouter,deepseek').split(',').map(p => p.trim()),
    maxIterations: parseInt(process.env.MAX_ITERATIONS || '5', 10),
    pauseTimeoutMs: parseInt(process.env.PAUSE_TIMEOUT_MS || '30000', 10),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  r2: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    accessKey: process.env.CLOUDFLARE_R2_ACCESS_KEY || '',
    bucket: process.env.CLOUDFLARE_R2_BUCKET || 'andclaw-audio',
  },
  db: {
    url: process.env.DATABASE_URL || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    allowedOrigin: process.env.ALLOWED_ORIGIN || '',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  google: {
    accountsJson: process.env.GOOGLE_ACCOUNTS_JSON || '[]',
    oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    oauthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || '',
    exportCalendarId: process.env.GOOGLE_EXPORT_CALENDAR_ID || 'primary',
    calendarSyncInterval: parseInt(process.env.CALENDAR_SYNC_INTERVAL_MIN || '30', 10),
  },
  auth: {
    password: process.env.AUTH_PASSWORD || '',
    tokenSecret: process.env.AUTH_TOKEN_SECRET || '',
    allowedEmails: (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
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
  },
  learning: {
    enabled: process.env.LEARNING_ENABLED === 'true',
    mode: (process.env.LEARNING_MODE || 'safe') as 'safe' | 'weighted' | 'full',
  }
};

// Validate critical variables
if (!config.telegram.token) {
  console.warn('WARNING: TELEGRAM_BOT_TOKEN is not set in environment variables.');
}

if (config.telegram.allowedUsers.length === 0 || config.telegram.allowedUsers[0] === '') {
  console.warn('WARNING: TELEGRAM_ALLOWED_USER_IDS is not set. Bot will reject all users.');
}
