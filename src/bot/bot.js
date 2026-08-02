import { Telegraf, Scenes, session } from 'telegraf';
import config from '../config/env.js';
import { onboardingScene, ONBOARDING_SCENE_ID } from './scenes/onboarding.scene.js';
import { getPreference } from '../services/preference.service.js';
import { handleChatMessage } from '../controllers/chat.controller.js';

if (!config.botToken) {
  throw new Error('BOT_TOKEN is missing in environment variables');
}

export const bot = new Telegraf(config.botToken);

const stage = new Scenes.Stage([onboardingScene]);

bot.use(session());
bot.use(stage.middleware());

bot.catch((err, ctx) => {
  console.error(`[TELEGRAF ERROR] for update ${ctx.updateType}:`, err);
});

bot.start(async (ctx) => {
  console.log(`[/start command received] from user: ${ctx.from?.id} (${ctx.from?.first_name})`);
  try {
    await ctx.scene.enter(ONBOARDING_SCENE_ID);
    console.log('[Onboarding scene entered]');
  } catch (err) {
    console.error('[Error entering onboarding scene]:', err);
  }
});

// Check if user needs onboarding on incoming messages
bot.use(async (ctx, next) => {
  if (ctx.from && ctx.chat) {
    if (ctx.scene && ctx.scene.current) {
      return next();
    }

    try {
      const pref = await getPreference(ctx.from.id);
      if (!pref || !pref.onboardingComplete) {
        console.log(`[User ${ctx.from.id} needs onboarding, entering scene...]`);
        return ctx.scene.enter(ONBOARDING_SCENE_ID);
      }
    } catch (err) {
      console.error('[Error checking preference]:', err);
    }
  }
  return next();
});

// Route text messages for onboarded users to chat controller
bot.on('text', handleChatMessage);

export default bot;
