import cron from 'node-cron';
import prisma from '../db/prisma.js';
import bot from '../bot/bot.js';
import { generatePersonalizedBriefing } from '../services/ai.service.js';
import { saveMessage } from '../services/message.service.js';

/**
 * Check and send scheduled daily briefings to users
 */
export async function sendScheduledBriefings() {
  const tz = process.env.TZ || 'Asia/Kolkata';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const currentTimeStr = formatter.format(new Date());

  console.log(`[Briefing Job] Checking scheduled briefings for time ${currentTimeStr} (${tz})...`);

  try {
    // Find preferences where onboarding is complete and briefingTime is set
    const preferences = await prisma.preference.findMany({
      where: {
        onboardingComplete: true,
        briefingTime: { not: null },
      },
      include: {
        user: true,
      },
    });

    for (const pref of preferences) {
      if (!pref.user || !pref.user.telegramId) continue;

      // Check if briefingTime matches (e.g. "08:00", "09:00", "16:00", "17:00", "19:00" or custom format "HH:mm")
      if (pref.briefingTime === currentTimeStr) {
        console.log(`[Briefing Job] Triggering personalized briefing for Telegram user: ${pref.user.telegramId}`);

        const briefingContent = await generatePersonalizedBriefing(pref);

        // Send briefing message directly to user on Telegram
        await bot.telegram.sendMessage(pref.user.telegramId, briefingContent, {
          parse_mode: 'Markdown',
        }).catch(async (err) => {
          // Fallback to plain text if Markdown parsing encounters error
          console.warn('[Briefing Job] Markdown send error, sending plain text fallback:', err.message);
          await bot.telegram.sendMessage(pref.user.telegramId, briefingContent);
        });

        // Save assistant briefing to message history database
        await saveMessage(pref.user.telegramId, 'assistant', briefingContent);
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
