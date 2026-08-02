import { getChatResponse } from '../services/ai.service.js';
import { saveMessage } from '../services/message.service.js';

/**
 * Handle incoming text messages for onboarded users
 * @param {import('telegraf').Context} ctx
 */
export async function handleChatMessage(ctx) {
  if (!ctx.message || !ctx.message.text) return;

  const userMessage = ctx.message.text.trim();

  // Ignore commands like /start or /help here
  if (userMessage.startsWith('/')) return;

  const userId = ctx.from.id;

  try {
    // Show typing status in Telegram while AI processes response
    await ctx.sendChatAction('typing').catch(() => {});

    // Save incoming user message turn to database
    await saveMessage(userId, 'user', userMessage);

    // Generate AI response with context
    const aiResponse = await getChatResponse(userId, userMessage);

    // Save assistant reply turn to database
    await saveMessage(userId, 'assistant', aiResponse);

    // Reply to user on Telegram
    await ctx.replyWithMarkdown(aiResponse).catch(async (err) => {
      // Fallback if Markdown parsing fails due to special characters
      console.warn('[ChatController] Markdown formatting error, sending plain text fallback:', err.message);
      await ctx.reply(aiResponse);
    });
  } catch (error) {
    console.error('[ChatController] Error processing chat message:', error);
    await ctx.reply('⚠️ Sorry, I encountered an error answering your question. Please try again.');
  }
}

export default {
  handleChatMessage,
};
