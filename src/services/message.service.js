import prisma from '../db/prisma.js';

/**
 * Save a message turn (user or assistant) to the database
 * @param {string|number} telegramId
 * @param {'user'|'assistant'} role
 * @param {string} content
 */
export async function saveMessage(telegramId, role, content) {
  const strId = String(telegramId);

  // Ensure user exists
  const user = await prisma.user.upsert({
    where: { telegramId: strId },
    update: {},
    create: { telegramId: strId },
  });

  return await prisma.message.create({
    data: {
      userId: user.id,
      role,
      content,
    },
  });
}

/**
 * Get recent conversation history for a user, ordered chronologically (oldest-first)
 * @param {string|number} telegramId
 * @param {number} limit
 */
export async function getRecentMessages(telegramId, limit = 20) {
  const strId = String(telegramId);

  const user = await prisma.user.findUnique({
    where: { telegramId: strId },
  });

  if (!user) return [];

  const messages = await prisma.message.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Reverse so history flows oldest-to-newest for LLM context
  return messages.reverse();
}

export default {
  saveMessage,
  getRecentMessages,
};
