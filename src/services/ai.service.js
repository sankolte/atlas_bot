import OpenAI from 'openai';
import config from '../config/env.js';
import { getPreference } from './preference.service.js';
import { getRecentMessages } from './message.service.js';
import { getRecentNews } from './news.service.js';

let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    if (!config.openaiApiKey || config.openaiApiKey.includes('your_') || config.openaiApiKey.includes('here')) {
      throw new Error('OPENAI_API_KEY is not configured in .env');
    }
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openaiClient;
}

/**
 * Build dynamic System Prompt for Atlas AI based on user profile and recent news context
 */
export function buildSystemPrompt(preference, newsItems = []) {
  const occupation = preference?.occupation || 'General User / Investor';
  const interests = Array.isArray(preference?.interests) ? preference.interests.join(', ') : 'General Finance & Markets';
  const industries = Array.isArray(preference?.industries) ? preference.industries.join(', ') : 'Broad Market';
  const updateTypes = Array.isArray(preference?.updateTypes) ? preference.updateTypes.join(', ') : 'Standard Market Updates';

  const newsContextString = newsItems.length > 0
    ? newsItems.map((n, idx) => `[News #${idx + 1}] Title: ${n.title} | Category: ${n.category || 'N/A'} | Company: ${n.company || 'N/A'} | Summary: ${n.summary}`).join('\n')
    : 'No recent breaking news items in current context database.';

  return `You are Atlas — an elite, highly personalized AI Financial Assistant operating inside Telegram.

YOUR USER PROFILE:
- Occupation / Role: ${occupation}
- Key Topics of Interest: ${interests}
- Tracked Industries: ${industries}
- Preferred Insight Types: ${updateTypes}

RECENT VERIFIED FINANCIAL NEWS CONTEXT (LAST 3 DAYS):
${newsContextString}

CORE INSTRUCTIONS & RESPONSE STYLE:
1. PERSONALIZATION & RELEVANCE: Always tailor your explanations to a ${occupation} interested in ${interests} and ${industries}.
2. WHY IT MATTERS: Do not just repeat raw news headers or generic descriptions. Clearly explain "WHY THIS MATTERS" to the user, highlighting market impacts, earnings insights, economic indicators, or industry trends.
3. CONCISE & ACTIONABLE: Keep responses crisp, structured, and easy to read on mobile Telegram screens. Use bullet points, bold key terms (*term*), and emojis.
4. NO NOISE: Filter out clickbait or fluff. Provide clear, professional, and insightful financial analysis.
5. HONESTY: If a user asks about a specific stock/event not in the news context, use your comprehensive financial knowledge base to answer accurately while maintaining your persona.`;
}

/**
 * Full AI chat pipeline execution
 * @param {string|number} telegramId
 * @param {string} userMessage
 */
export async function getChatResponse(telegramId, userMessage) {
  try {
    const openai = getOpenAIClient();

    // 1. Fetch user preference
    const preference = await getPreference(telegramId);

    // 2. Fetch recent chat history (last 20 turns)
    const history = await getRecentMessages(telegramId, 20);

    // 3. Fetch recent news items (last 3 days)
    const recentNews = await getRecentNews(3, 15);

    // 4. Construct System Prompt
    const systemPrompt = buildSystemPrompt(preference, recentNews);

    // 5. Construct OpenAI messages payload
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    // 6. Call OpenAI API (using fast, cost-effective gpt-4o-mini model)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });

    const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response right now. Please try again.";
    return reply;
  } catch (error) {
    console.error('[AIService] Error generating chat response:', error);
    if (error.message?.includes('OPENAI_API_KEY')) {
      return "⚠️ OpenAI API key is missing or invalid. Please check your `.env` configuration.";
    }
    return "⚠️ Sorry, I ran into an issue retrieving market insights. Please try again in a moment.";
  }
}

export default {
  buildSystemPrompt,
  getChatResponse,
};
