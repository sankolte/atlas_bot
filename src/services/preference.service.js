import prisma from '../db/prisma.js';

/**
 * Fetch preference by Telegram ID
 * @param {string|number} telegramId
 */
export async function getPreference(telegramId) {
  const strId = String(telegramId);
  const user = await prisma.user.findUnique({
    where: { telegramId: strId },
    include: { preference: true },
  });

  return user ? user.preference : null;
}

/**
 * Upsert user and user preference
 * @param {string|number} telegramId
 * @param {Object} data
 */
export async function upsertPreference(telegramId, data) {
  const strId = String(telegramId);

  // Ensure user exists
  const user = await prisma.user.upsert({
    where: { telegramId: strId },
    update: {},
    create: { telegramId: strId },
  });

  const existingPref = await prisma.preference.findUnique({ where: { userId: user.id } });
  const resetLastSent = data.briefingTime !== undefined && existingPref && existingPref.briefingTime !== data.briefingTime;

  // Upsert preference connected to user
  const preference = await prisma.preference.upsert({
    where: { userId: user.id },
    update: {
      occupation: data.occupation ?? undefined,
      interests: data.interests ?? undefined,
      industries: data.industries ?? undefined,
      updateTypes: data.updateTypes ?? undefined,
      briefingTime: data.briefingTime !== undefined ? data.briefingTime : undefined,
      lastBriefingSentDate: resetLastSent ? null : undefined,
      onboardingComplete: data.onboardingComplete ?? true,
    },
    create: {
      userId: user.id,
      occupation: data.occupation || null,
      interests: data.interests || [],
      industries: data.industries || [],
      updateTypes: data.updateTypes || [],
      briefingTime: data.briefingTime || null,
      onboardingComplete: data.onboardingComplete ?? true,
    },
  });

  return preference;
}

export default {
  getPreference,
  upsertPreference,
};
