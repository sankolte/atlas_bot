import { Scenes } from 'telegraf';
import {
  getStartKeyboard,
  getOccupationKeyboard,
  getInterestsKeyboard,
  getIndustriesKeyboard,
  getUpdateTypesKeyboard,
  getBriefingTimeKeyboard,
  OCCUPATION_OPTIONS,
  TIME_OPTIONS,
} from '../keyboards/onboarding.keyboards.js';
import { upsertPreference } from '../../services/preference.service.js';

export const ONBOARDING_SCENE_ID = 'ONBOARDING_WIZARD';

function normalizeTimeString(input) {
  if (!input) return null;
  const cleaned = input.trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return cleaned;
  const hours = match[1].padStart(2, '0');
  const minutes = match[2].padStart(2, '0');
  return `${hours}:${minutes}`;
}

export const onboardingScene = new Scenes.WizardScene(
  ONBOARDING_SCENE_ID,

  // --- STEP 0: Welcome / Greet ---
  async (ctx) => {
    ctx.wizard.state.interests = [];
    ctx.wizard.state.industries = [];
    ctx.wizard.state.updateTypes = [];
    ctx.wizard.state.awaitingCustom = null;

    const greeting =
      `👋 *Hi, I'm Atlas!*\n\n` +
      `I track financial markets, fetch top market news, and send personalized briefings straight to your Telegram.\n\n` +
      `Let's quickly set up your preferences so I can tailor insights for you!`;

    await ctx.replyWithMarkdown(greeting, getStartKeyboard());
    return ctx.wizard.next();
  },

  // --- STEP 1: Occupation (Buttons or Custom Text) ---
  async (ctx) => {
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery().catch(() => {});

      if (data.startsWith('select_occ_')) {
        const idx = parseInt(data.replace('select_occ_', ''), 10);
        const choice = OCCUPATION_OPTIONS[idx];

        if (choice && choice.includes('Custom')) {
          ctx.wizard.state.awaitingCustom = 'occupation';
          await ctx.replyWithMarkdown('✏️ *Please type your custom role below:*');
          return;
        }

        ctx.wizard.state.occupation = choice || 'General User';

        await ctx.replyWithMarkdown(
          `2️⃣ *Which topics interest you?*\n_(Select preset topics or tap ✏️ Add Custom)_`,
          getInterestsKeyboard(ctx.wizard.state.interests)
        );
        return ctx.wizard.next();
      }
    }

    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text.trim();

      ctx.wizard.state.occupation = text;
      ctx.wizard.state.awaitingCustom = null;

      await ctx.replyWithMarkdown(
        `2️⃣ *Which topics interest you?*\n_(Select preset topics or tap ✏️ Add Custom)_`,
        getInterestsKeyboard(ctx.wizard.state.interests)
      );
      return ctx.wizard.next();
    }

    await ctx.reply('Please tap one of the occupation options above or type your role.');
  },

  // --- STEP 2: Interests (Multi-select + Custom) ---
  async (ctx) => {
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery().catch(() => {});

      if (data === 'add_custom_interest') {
        ctx.wizard.state.awaitingCustom = 'interest';
        await ctx.replyWithMarkdown('✏️ *Type your custom topic below:* _(e.g., Gold & Commodities, Forex, Polymarket)_');
        return;
      }

      if (data.startsWith('toggle_interest_')) {
        const item = data.replace('toggle_interest_', '');
        const arr = ctx.wizard.state.interests || [];
        if (arr.includes(item)) {
          ctx.wizard.state.interests = arr.filter((i) => i !== item);
        } else {
          ctx.wizard.state.interests.push(item);
        }
        await ctx.editMessageReplyMarkup(
          getInterestsKeyboard(ctx.wizard.state.interests).reply_markup
        ).catch(() => {});
        return;
      }

      if (data === 'done_interests') {
        ctx.wizard.state.awaitingCustom = null;
        await ctx.replyWithMarkdown(
          `3️⃣ *Which industries do you follow?*\n_(Select preset industries or tap ✏️ Add Custom)_`,
          getIndustriesKeyboard(ctx.wizard.state.industries)
        );
        return ctx.wizard.next();
      }
    }

    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text.trim();
      if (ctx.wizard.state.awaitingCustom === 'interest') {
        if (!ctx.wizard.state.interests.includes(text)) {
          ctx.wizard.state.interests.push(text);
        }
        ctx.wizard.state.awaitingCustom = null;
        await ctx.replyWithMarkdown(
          `✅ Added *"${text}"* to your topics!`,
          getInterestsKeyboard(ctx.wizard.state.interests)
        );
        return;
      }
      await ctx.reply('Please select your topics using the buttons above and tap "Done ➡️".');
    }
  },

  // --- STEP 3: Industries (Multi-select + Custom) ---
  async (ctx) => {
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery().catch(() => {});

      if (data === 'add_custom_industry') {
        ctx.wizard.state.awaitingCustom = 'industry';
        await ctx.replyWithMarkdown('✏️ *Type your custom industry below:* _(e.g., Semiconductors, Defense, Biotech)_');
        return;
      }

      if (data.startsWith('toggle_industry_')) {
        const item = data.replace('toggle_industry_', '');
        const arr = ctx.wizard.state.industries || [];
        if (arr.includes(item)) {
          ctx.wizard.state.industries = arr.filter((i) => i !== item);
        } else {
          ctx.wizard.state.industries.push(item);
        }
        await ctx.editMessageReplyMarkup(
          getIndustriesKeyboard(ctx.wizard.state.industries).reply_markup
        ).catch(() => {});
        return;
      }

      if (data === 'done_industries') {
        ctx.wizard.state.awaitingCustom = null;
        await ctx.replyWithMarkdown(
          `4️⃣ *What updates would you like to receive?*\n_(Select preset updates or tap ✏️ Add Custom)_`,
          getUpdateTypesKeyboard(ctx.wizard.state.updateTypes)
        );
        return ctx.wizard.next();
      }
    }

    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text.trim();
      if (ctx.wizard.state.awaitingCustom === 'industry') {
        if (!ctx.wizard.state.industries.includes(text)) {
          ctx.wizard.state.industries.push(text);
        }
        ctx.wizard.state.awaitingCustom = null;
        await ctx.replyWithMarkdown(
          `✅ Added *"${text}"* to your industries!`,
          getIndustriesKeyboard(ctx.wizard.state.industries)
        );
        return;
      }
      await ctx.reply('Please select your industries using the buttons above and tap "Done ➡️".');
    }
  },

  // --- STEP 4: Update Types (Multi-select + Custom) ---
  async (ctx) => {
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery().catch(() => {});

      if (data === 'add_custom_update') {
        ctx.wizard.state.awaitingCustom = 'update';
        await ctx.replyWithMarkdown('✏️ *Type your custom update preference below:* _(e.g., Earnings Call Alerts, Fed Interest Rate Alerts)_');
        return;
      }

      if (data.startsWith('toggle_update_')) {
        const item = data.replace('toggle_update_', '');
        const arr = ctx.wizard.state.updateTypes || [];
        if (arr.includes(item)) {
          ctx.wizard.state.updateTypes = arr.filter((i) => i !== item);
        } else {
          ctx.wizard.state.updateTypes.push(item);
        }
        await ctx.editMessageReplyMarkup(
          getUpdateTypesKeyboard(ctx.wizard.state.updateTypes).reply_markup
        ).catch(() => {});
        return;
      }

      if (data === 'done_updates') {
        ctx.wizard.state.awaitingCustom = null;
        await ctx.replyWithMarkdown(
          `5️⃣ *When would you like daily insights?*\n_(Select preferred briefing time or tap ✏️ Custom Time)_`,
          getBriefingTimeKeyboard()
        );
        return ctx.wizard.next();
      }
    }

    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text.trim();
      if (ctx.wizard.state.awaitingCustom === 'update') {
        if (!ctx.wizard.state.updateTypes.includes(text)) {
          ctx.wizard.state.updateTypes.push(text);
        }
        ctx.wizard.state.awaitingCustom = null;
        await ctx.replyWithMarkdown(
          `✅ Added *"${text}"* to your update preferences!`,
          getUpdateTypesKeyboard(ctx.wizard.state.updateTypes)
        );
        return;
      }
      await ctx.reply('Please select your updates using the buttons above and tap "Done ➡️".');
    }
  },

// --- STEP 5: Briefing Time (Single Select / Custom Time & Save) ---
  async (ctx) => {
    const saveAndFinish = async (rawTime, customTimeStr = null) => {
      const briefingTime = rawTime === 'none' ? null : normalizeTimeString(customTimeStr || rawTime);

      const occupation = ctx.wizard.state.occupation || 'Not specified';
      const interests = ctx.wizard.state.interests || [];
      const industries = ctx.wizard.state.industries || [];
      const updateTypes = ctx.wizard.state.updateTypes || [];

      await upsertPreference(ctx.from.id, {
        occupation,
        interests,
        industries,
        updateTypes,
        briefingTime,
        onboardingComplete: true,
      });

      let timeLabel = 'Don\'t send';
      if (customTimeStr) {
        timeLabel = `⏰ ${customTimeStr}`;
      } else if (rawTime !== 'none') {
        timeLabel = TIME_OPTIONS.find((t) => t.value === rawTime)?.label || rawTime;
      }

      const summary =
        `🎉 *Setup Complete! All preferences saved.*\n\n` +
        `👤 *Occupation:* ${occupation}\n` +
        `💡 *Topics:* ${interests.length > 0 ? interests.join(', ') : 'General'}\n` +
        `🏢 *Industries:* ${industries.length > 0 ? industries.join(', ') : 'All'}\n` +
        `🔔 *Updates:* ${updateTypes.length > 0 ? updateTypes.join(', ') : 'Standard'}\n` +
        `⏰ *Daily Insight:* ${timeLabel}\n\n` +
        `You're all set! You can ask me financial news or market questions anytime.`;

      await ctx.replyWithMarkdown(summary);
      return ctx.scene.leave();
    };

    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      await ctx.answerCbQuery().catch(() => {});

      if (data === 'select_time_custom') {
        ctx.wizard.state.awaitingCustom = 'time';
        await ctx.replyWithMarkdown('⏰ *Type your custom briefing time below in 24h format:* _(e.g., 10:30, 14:00, 21:45)_');
        return;
      }

      if (data.startsWith('select_time_')) {
        const rawTime = data.replace('select_time_', '');
        return await saveAndFinish(rawTime);
      }
    }

    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text.trim();
      if (ctx.wizard.state.awaitingCustom === 'time') {
        return await saveAndFinish('custom', text);
      }
      await ctx.reply('Please select your preferred briefing time or tap ✏️ Custom Time.');
    }
  }
);

// Intercept commands and bottom-menu button taps inside onboarding scene
onboardingScene.use(async (ctx, next) => {
  if (ctx.message && ctx.message.text) {
    const text = ctx.message.text.trim();

    if (text.startsWith('/')) {
      const command = text.split(/\s+/)[0].toLowerCase();

      if (command === '/start') {
        ctx.wizard.state.interests = [];
        ctx.wizard.state.industries = [];
        ctx.wizard.state.updateTypes = [];
        ctx.wizard.state.awaitingCustom = null;
        ctx.wizard.selectStep(0);

        const greeting =
          `👋 *Hi, I'm Atlas!*\n\n` +
          `I track financial markets, fetch top market news, and send personalized briefings straight to your Telegram.\n\n` +
          `Let's quickly set up your preferences so I can tailor insights for you!`;

        await ctx.replyWithMarkdown(greeting, getStartKeyboard());
        return ctx.wizard.next();
      }

      if (command === '/skip' || command === '/cancel') {
        await upsertPreference(ctx.from.id, { onboardingComplete: true });
        await ctx.replyWithMarkdown(
          `⚡ *Skipped for now!*\n\nYou can set up your preferences anytime by typing /start. Feel free to ask me any finance question!`
        );
        return ctx.scene.leave();
      }

      // For any other command (/help, /addfeed, /briefing, /preferences, /notion, etc.):
      // Exit onboarding scene and pass control downstream to bot.js command handlers
      await ctx.scene.leave();
      return next();
    }

    const MENU_BUTTONS = ['📰 Latest Briefing', '⚡ Market Scan', '⚙️ My Preferences', '❓ Help'];
    if (MENU_BUTTONS.includes(text)) {
      await ctx.scene.leave();
      return next();
    }
  }

  return next();
});

// Global Action Listeners on Onboarding Scene for 100% Reliable Button Taps
onboardingScene.action('start_onboarding', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.wizard.state.interests = ctx.wizard.state.interests || [];
  ctx.wizard.state.industries = ctx.wizard.state.industries || [];
  ctx.wizard.state.updateTypes = ctx.wizard.state.updateTypes || [];
  ctx.wizard.selectStep(1);
  await ctx.replyWithMarkdown(
    `1️⃣ *What do you do?*\n_(Tap a quick option or select Custom to type)_`,
    getOccupationKeyboard()
  );
});

onboardingScene.action('skip_onboarding', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await upsertPreference(ctx.from.id, { onboardingComplete: true });
  await ctx.replyWithMarkdown(
    `⚡ *Skipped for now!*\n\nYou can set up your preferences anytime by typing /start. Feel free to ask me any finance question!`
  );
  return ctx.scene.leave();
});
