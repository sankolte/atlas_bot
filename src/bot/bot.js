import { Telegraf } from 'telegraf';
import config from '../config/env.js';

if (!config.botToken) {
  throw new Error('BOT_TOKEN is missing in environment variables');
}

export const bot = new Telegraf(config.botToken);

bot.start((ctx) => {
  const introMessage = 
    `👋 *Welcome to Atlas AI!* 🚀\n\n` +
    `I'm your personal *Financial News & Market Assistant*. Here is what I can do for you:\n\n` +
    `📰 *Tailored News Feed* — Stay updated with financial news customized to your sector and interests.\n` +
    `⏰ *Daily Briefings* — Receive automated morning & evening summaries right inside Telegram.\n` +
    `💡 *Market Insights & Q&A* — Ask me questions about stocks, market updates, or company comparisons anytime!\n\n` +
    `Type /start anytime to restart onboarding or type your questions directly to get started.`;

  ctx.replyWithMarkdown(introMessage);
});

export default bot;
