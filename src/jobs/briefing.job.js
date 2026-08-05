import cron from 'node-cron';
import prisma from '../db/prisma.js';
import bot from '../bot/bot.js';
import { generatePersonalizedBriefing } from '../services/ai.service.js';
import { saveMessage } from '../services/message.service.js';
import { sanitizeTelegramHtml, stripHtml } from '../utils/html.utils.js';

/**
 * Check and send scheduled daily briefings to users
 */
export async function sendScheduledBriefings() {
  const tz = process.env.TARGET_TIMEZONE || process.env.APP_TZ || (process.env.TZ && process.env.TZ !== 'UTC' ? process.env.TZ : 'Asia/Kolkata');
  const now = new Date();

  // Format current time as zero-padded 24h HH:mm (e.g. "16:00")
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentTimeStr = timeFormatter.format(now);

  // Format current date as YYYY-MM-DD in target timezone (e.g. "2026-08-03")
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const currentDateStr = dateFormatter.format(now);

  try {
    // 1. Query users whose briefingTime matches current HH:mm
    const candidates = await prisma.preference.findMany({
      where: {
        onboardingComplete: true,
        briefingTime: currentTimeStr,
      },
      include: {
        user: true,
      },
    });

    // 2. Filter out users who already received a briefing today in target timezone
    const eligiblePreferences = candidates.filter((pref) => {
      if (!pref.lastBriefingSentDate) return true;
      const lastSentDateStr = dateFormatter.format(new Date(pref.lastBriefingSentDate));
      return lastSentDateStr !== currentDateStr;
    });

    // 3. Clear logging on every 1-minute tick for Render live log visibility
    console.log(
      `[Briefing Job] Cron tick at ${currentTimeStr} (${currentDateStr} ${tz}) | Candidates matching time: ${candidates.length} | Eligible (not sent today): ${eligiblePreferences.length}`
    );

    for (const pref of eligiblePreferences) {
      if (!pref.user || !pref.user.telegramId) continue;

      console.log(`[Briefing Job] 🚀 Sending daily briefing to Telegram user: ${pref.user.telegramId}`);

      try {
        // Immediate DB update before generating AI to prevent duplicate sends on overlapping ticks
        await prisma.preference.update({
          where: { id: pref.id },
          data: { lastBriefingSentDate: new Date() },
        });

        // Generate AI briefing and sanitize HTML for Telegram
        const briefingContent = await generatePersonalizedBriefing(pref);
        const sanitizedBriefing = sanitizeTelegramHtml(briefingContent);

        // Send briefing message directly to user on Telegram with HTML parse mode
        await bot.telegram
          .sendMessage(pref.user.telegramId, sanitizedBriefing, { parse_mode: 'HTML' })
          .catch(async (err) => {
            console.warn('[Briefing Job] HTML send warning, sending clean plain text fallback:', err.message);
            await bot.telegram.sendMessage(pref.user.telegramId, stripHtml(sanitizedBriefing));
          });

        // Save assistant briefing to message history database
        await saveMessage(pref.user.telegramId, 'assistant', briefingContent);
        console.log(`[Briefing Job] ✅ Successfully delivered briefing to user: ${pref.user.telegramId}`);
      } catch (err) {
        console.error(`[Briefing Job] ❌ Error delivering briefing to user ${pref.user.telegramId}:`, err);
      }
    }
  } catch (error) {
    console.error('[Briefing Job] Error running scheduled briefings:', error);
  }
}

/**
 * Initialize briefing cron job running every minute
 */
export function initBriefingJob() {
  console.log('[Briefing Job] Initializing scheduled briefing cron job (every minute: * * * * *)...');

  const task = cron.schedule('* * * * *', async () => {
    await sendScheduledBriefings();
  });

  return task;
}

export default initBriefingJob;
