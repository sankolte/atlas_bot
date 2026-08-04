import { Telegraf, Scenes, session, Markup } from 'telegraf';
import config from '../config/env.js';
import { onboardingScene, ONBOARDING_SCENE_ID } from './scenes/onboarding.scene.js';
import { getPreference } from '../services/preference.service.js';
import { handleChatMessage } from '../controllers/chat.controller.js';
import { generatePersonalizedBriefing } from '../services/ai.service.js';
import { saveMessage } from '../services/message.service.js';
import { saveNotionConfig, pushBriefingToNotion } from '../services/notion.service.js';
import { addUserFeed, getUserFeeds, removeUserFeed } from '../services/rss.service.js';
import { sanitizeTelegramHtml, stripHtml } from '../utils/html.utils.js';

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

/**
 * Persistent bottom menu keyboard
 */
export function getMainMenuKeyboard() {
  return Markup.keyboard([
    ['📰 Latest Briefing', '⚡ Market Scan'],
    ['⚙️ My Preferences', '❓ Help'],
  ]).resize();
}

// Preset Popular Financial RSS Feeds
const PRESET_FEEDS = {
  techcrunch: { label: '📰 TechCrunch', url: 'https://techcrunch.com/feed/' },
  marketwatch: { label: '📈 MarketWatch Top Stories', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  venturebeat: { label: '🚀 VentureBeat', url: 'https://venturebeat.com/feed/' },
  yahoofinance: { label: '💼 Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
};

// Set Native Telegram Bot Menu Commands
bot.telegram.setMyCommands([
  { command: 'start', description: 'Reset & start onboarding' },
  { command: 'briefing', description: 'Get instant AI market briefing' },
  { command: 'preferences', description: 'View & edit your profile settings' },
  { command: 'notion', description: 'Connect & manage Notion workspace' },
  { command: 'exportnotion', description: 'Export briefing to Notion' },
  { command: 'addfeed', description: 'Add custom RSS feed URL' },
  { command: 'listfeeds', description: 'List active RSS feeds' },
  { command: 'help', description: 'How to use Atlas AI' },
]).catch((err) => console.warn('[Bot] Could not set Telegram commands menu:', err.message));

bot.start(async (ctx) => {
  console.log(`[/start command received] from user: ${ctx.from?.id} (${ctx.from?.first_name})`);
  try {
    await ctx.scene.enter(ONBOARDING_SCENE_ID);
  } catch (err) {
    console.error('[Error entering onboarding scene]:', err);
  }
});

bot.help(async (ctx) => {
  const helpText =
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <b>ATLAS AI — HELP & GUIDE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>Available Commands:</b>\n` +
    `• <code>/start</code> — Re-run interactive setup\n` +
    `• <code>/briefing</code> — Generate on-demand AI market briefing\n` +
    `• <code>/preferences</code> — View & manage your profile\n` +
    `• <code>/notion</code> — Connect & manage Notion workspace\n` +
    `• <code>/exportnotion</code> — Push briefing to Notion\n` +
    `• <code>/addfeed</code> — Add popular or custom RSS feed\n` +
    `• <code>/listfeeds</code> — View custom RSS feeds\n` +
    `• <code>/help</code> — Show this guide\n\n` +
    `💬 <b>How to Chat:</b>\n` +
    `Simply type any financial or market question directly into the chat! Atlas analyzes verified news and tailors answers specifically to your role.`;

  await ctx.replyWithHTML(helpText, getMainMenuKeyboard());
});

// On-demand Briefing command (/briefing or button tap)
bot.command('briefing', async (ctx) => {
  await handleOnDemandBriefing(ctx);
});
bot.hears('📰 Latest Briefing', async (ctx) => {
  await handleOnDemandBriefing(ctx);
});

async function handleOnDemandBriefing(ctx) {
  try {
    await ctx.sendChatAction('typing').catch(() => {});
    const pref = await getPreference(ctx.from.id);

    if (!pref || !pref.onboardingComplete) {
      return ctx.scene.enter(ONBOARDING_SCENE_ID);
    }

    await ctx.replyWithHTML('⚡ <i>Generating your personalized market briefing...</i>');

    const briefingText = await generatePersonalizedBriefing(pref);
    const sanitizedBriefing = sanitizeTelegramHtml(briefingText);

    await ctx.replyWithHTML(sanitizedBriefing, getMainMenuKeyboard()).catch(async (err) => {
      console.warn('[Bot] HTML send warning for briefing, sending clean fallback:', err.message);
      await ctx.reply(stripHtml(sanitizedBriefing), getMainMenuKeyboard());
    });

    await saveMessage(ctx.from.id, 'assistant', briefingText);
  } catch (err) {
    console.error('[Bot] Error handling briefing:', err);
    await ctx.reply('⚠️ Unable to generate briefing right now. Please try again.');
  }
}

// Preferences Card (/preferences or button tap)
bot.command('preferences', async (ctx) => {
  await handleViewPreferences(ctx);
});
bot.hears('⚙️ My Preferences', async (ctx) => {
  await handleViewPreferences(ctx);
});

async function handleViewPreferences(ctx) {
  try {
    const pref = await getPreference(ctx.from.id);
    if (!pref || !pref.onboardingComplete) {
      return ctx.scene.enter(ONBOARDING_SCENE_ID);
    }

    const occupation = pref.occupation || 'Not specified';
    const interests = Array.isArray(pref.interests) && pref.interests.length > 0 ? pref.interests.join(', ') : 'General';
    const industries = Array.isArray(pref.industries) && pref.industries.length > 0 ? pref.industries.join(', ') : 'All';
    const updateTypes = Array.isArray(pref.updateTypes) && pref.updateTypes.length > 0 ? pref.updateTypes.join(', ') : 'Standard';
    const briefingTime = pref.briefingTime ? `⏰ ${pref.briefingTime}` : '❌ Off';
    const notionStatus = pref.notionApiKey ? '✅ Connected' : '❌ Not connected';

    const cardText =
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>YOUR ATLAS PROFILE</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💼 <b>Occupation:</b> ${occupation}\n` +
      `💡 <b>Topics:</b> ${interests}\n` +
      `🏢 <b>Industries:</b> ${industries}\n` +
      `🔔 <b>Updates:</b> ${updateTypes}\n` +
      `⏰ <b>Daily Insight:</b> ${briefingTime}\n` +
      `📝 <b>Notion Workspace:</b> ${notionStatus}\n\n` +
      `─────────────────────────\n` +
      `<i>Tap below to re-run setup or customize settings.</i>`;

    const editKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Re-run Setup', 'restart_setup_from_card')],
    ]);

    await ctx.replyWithHTML(cardText, editKeyboard);
  } catch (err) {
    console.error('[Bot] Error viewing preferences:', err);
  }
}

bot.action('restart_setup_from_card', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  return ctx.scene.enter(ONBOARDING_SCENE_ID);
});

// --- NOTION INTEGRATION COMMANDS & AUTO DETECT ---
bot.command('notion', async (ctx) => {
  await showNotionCard(ctx);
});

async function showNotionCard(ctx) {
  try {
    const pref = await getPreference(ctx.from.id);
    const isConnected = pref?.notionApiKey && pref?.notionDatabaseId;

    const statusText =
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 <b>NOTION WORKSPACE INTEGRATION</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Status:</b> ${isConnected ? '✅ Connected' : '❌ Not Connected'}\n\n` +
      `<b>How it works:</b>\n` +
      `Atlas automatically exports your Daily AI Briefings & Financial Research directly into your Notion workspace database.\n\n` +
      `<b>Quick Setup:</b>\n` +
      `Simply send your Notion Token in chat:\n` +
      `<code>/setnotion YOUR_NOTION_TOKEN</code>\n\n` +
      `<i>Or send token directly:</i> <code>ntn_250575...</code>`;

    const buttons = isConnected
      ? [
          [Markup.button.callback('📤 Export Briefing to Notion', 'btn_export_notion')],
          [Markup.button.callback('🔄 Re-connect Token', 'btn_connect_notion')],
        ]
      : [[Markup.button.callback('🔑 How to Connect Notion', 'btn_connect_notion')]];

    await ctx.replyWithHTML(statusText, Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.error('[Bot] Error in /notion:', err);
  }
}

bot.action('btn_connect_notion', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.replyWithHTML(
    `🔑 <b>How to Connect Your Notion Workspace:</b>\n\n` +
    `1️⃣ Go to <a href="https://www.notion.so/my-integrations">notion.so/my-integrations</a> and create an Integration to get your Token (starts with <code>ntn_...</code> or <code>secret_...</code>).\n` +
    `2️⃣ Open your Notion Database page ➔ click <b>•••</b> (top right) ➔ <b>Add connections</b> ➔ select your integration.\n\n` +
    `3️⃣ Send your token directly in chat or type:\n` +
    `<code>/setnotion YOUR_NOTION_TOKEN</code>`
  );
});

bot.action('btn_export_notion', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await handleExportToNotion(ctx);
});

// Auto-detect Notion token strings starting with ntn_ or secret_
bot.hears(/^(ntn_|secret_).*/, async (ctx) => {
  const token = ctx.message.text.trim();
  console.log(`[Auto-detect Notion Token] Received token from user: ${ctx.from?.id}`);
  await handleSetNotionToken(ctx, token);
});

bot.command('setnotion', async (ctx) => {
  const text = ctx.message.text.replace('/setnotion', '').trim();
  if (!text || text.length < 10) {
    return ctx.replyWithHTML(
      `⚠️ <b>How to Connect Your Notion Workspace:</b>\n\n` +
      `Send your Notion Access Token:\n` +
      `<code>/setnotion YOUR_NOTION_TOKEN</code>\n\n` +
      `<i>Example:</i> <code>/setnotion ntn_250575924...</code>`
    );
  }
  await handleSetNotionToken(ctx, text);
});

async function handleSetNotionToken(ctx, text) {
  try {
    let notionApiKey = text;
    let notionDatabaseId = null;

    if (text.includes('|')) {
      const parts = text.split('|');
      notionApiKey = parts[0].trim();
      notionDatabaseId = parts[1].trim();
    }

    await ctx.replyWithHTML('⏳ <i>Connecting to Notion workspace & discovering database...</i>');
    const result = await saveNotionConfig(ctx.from.id, notionApiKey, notionDatabaseId);

    await ctx.replyWithHTML(
      `🎉 <b>Notion Workspace Connected!</b>\n\n` +
      `📌 <b>Database ID:</b> <code>${result.databaseId}</code>\n\n` +
      `Use <code>/exportnotion</code> anytime to push daily briefings directly to Notion!`
    );
  } catch (err) {
    console.error('[Bot] Error setting Notion:', err);
    await ctx.replyWithHTML(`❌ <b>Failed to connect Notion:</b> ${err.message}`);
  }
}

bot.command('exportnotion', async (ctx) => {
  await handleExportToNotion(ctx);
});

async function handleExportToNotion(ctx) {
  try {
    const pref = await getPreference(ctx.from.id);
    if (!pref || !pref.notionApiKey) {
      return ctx.replyWithHTML('❌ Notion is not connected. Use <code>/notion</code> to set it up.');
    }

    await ctx.replyWithHTML('⏳ <i>Exporting latest briefing to Notion...</i>');

    const briefingText = await generatePersonalizedBriefing(pref);
    const title = `Atlas Financial Briefing - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    await pushBriefingToNotion(ctx.from.id, title, briefingText);

    await ctx.replyWithHTML('🎉 <b>Exported to Notion!</b> Check your Notion database.');
  } catch (err) {
    console.error('[Bot] Error exporting to Notion:', err);
    await ctx.replyWithHTML(`❌ <b>Export failed:</b> ${err.message}`);
  }
}

// --- RSS FEED COMMANDS & 1-TAP PRESETS ---
bot.command('addfeed', async (ctx) => {
  try {
    const url = ctx.message.text.replace('/addfeed', '').trim();

    if (!url || !url.startsWith('http')) {
      const presetKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(PRESET_FEEDS.techcrunch.label, 'add_preset_techcrunch'),
          Markup.button.callback(PRESET_FEEDS.marketwatch.label, 'add_preset_marketwatch'),
        ],
        [
          Markup.button.callback(PRESET_FEEDS.venturebeat.label, 'add_preset_venturebeat'),
          Markup.button.callback(PRESET_FEEDS.yahoofinance.label, 'add_preset_yahoofinance'),
        ],
      ]);

      return ctx.replyWithHTML(
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📰 <b>ADD FINANCIAL RSS FEED</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Tap a popular feed below to add it in 1-tap, or type:\n` +
        `<code>/addfeed YOUR_CUSTOM_RSS_URL</code>\n\n` +
        `<i>Example:</i> <code>/addfeed https://techcrunch.com/feed/</code>`,
        presetKeyboard
      );
    }

    await processAddRssFeed(ctx, url);
  } catch (err) {
    console.error('[Bot] Error adding RSS feed:', err);
    await ctx.replyWithHTML(`❌ <b>Failed to add feed:</b> ${err.message}`);
  }
});

// Handle Preset Feed Taps
bot.action(/add_preset_(.*)/, async (ctx) => {
  const key = ctx.match[1];
  const feed = PRESET_FEEDS[key];
  await ctx.answerCbQuery().catch(() => {});

  if (feed) {
    await processAddRssFeed(ctx, feed.url);
  }
});

async function processAddRssFeed(ctx, url) {
  await ctx.replyWithHTML(`⏳ <i>Validating and ingesting RSS feed: ${url}...</i>`);
  const res = await addUserFeed(ctx.from.id, url);

  await ctx.replyWithHTML(
    `🎉 <b>Feed Added Successfully!</b>\n\n` +
    `📰 <b>Title:</b> ${res.feed.title || url}\n` +
    `📥 <b>Articles Ingested:</b> ${res.insertedArticles}`
  );
}

bot.command('listfeeds', async (ctx) => {
  try {
    const feeds = await getUserFeeds(ctx.from.id);

    if (feeds.length === 0) {
      return ctx.replyWithHTML(
        `📰 <b>CUSTOM RSS FEEDS</b>\n\n` +
        `You have 0 custom feeds registered.\n` +
        `Type <code>/addfeed</code> to choose from popular feeds or add a custom URL!`
      );
    }

    let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━\n📰 <b>YOUR CUSTOM RSS FEEDS</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const deleteButtons = [];

    feeds.forEach((f, idx) => {
      msg += `${idx + 1}. <b>${f.title || f.feedUrl}</b>\n<code>${f.feedUrl}</code>\n\n`;
      deleteButtons.push([Markup.button.callback(`❌ Delete "${(f.title || 'Feed').substring(0, 20)}"`, `delete_feed_${f.id}`)]);
    });

    await ctx.replyWithHTML(msg, Markup.inlineKeyboard(deleteButtons));
  } catch (err) {
    console.error('[Bot] Error listing feeds:', err);
  }
});

bot.action(/delete_feed_(.*)/, async (ctx) => {
  const feedId = ctx.match[1];
  await ctx.answerCbQuery().catch(() => {});
  await removeUserFeed(ctx.from.id, feedId);
  await ctx.replyWithHTML('🗑️ <b>Feed removed successfully!</b>');
});

// Quick Market Scan button tap
bot.hears('⚡ Market Scan', async (ctx) => {
  ctx.message.text = 'Give me a quick 3-bullet market scan of top news today.';
  return handleChatMessage(ctx);
});

// Help button tap
bot.hears('❓ Help', async (ctx) => {
  return ctx.replyWithHTML(
    `💡 <b>Need Assistance?</b>\n\n` +
    `Ask any question directly like:\n` +
    `• <i>"What is the stock price trend for TSLA?"</i>\n` +
    `• <i>"How does inflation affect real estate?"</i>\n\n` +
    `Or use /briefing to trigger an instant news update!`,
    getMainMenuKeyboard()
  );
});

// Onboarding check middleware for incoming text
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
