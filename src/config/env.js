import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'BOT_TOKEN',
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'NEWS_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`[WARNING] Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  botToken: process.env.BOT_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  openaiApiKey: process.env.OPENAI_API_KEY,
  newsApiKey: process.env.NEWS_API_KEY,
  port: parseInt(process.env.PORT || '3000', 10),
};

export default config;
