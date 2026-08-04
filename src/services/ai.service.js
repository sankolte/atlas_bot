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
 * Build dynamic System Prompt for Atlas AI using Telegram HTML formatting rules
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

FORMATTING & RESPONSE RULES (TELEGRAM HTML MODE):
1. Use Telegram HTML tags for styling: <b>bold</b>, <i>italic</i>, <code>code</code>, and <blockquote>blockquotes for key insights/why it matters</blockquote>.
2. Use clean visual dividers like: ━━━━━━━━━━━━━━━━━━━━━━━━━ or ─────────────────────────
3. WHY IT MATTERS: Do not just list news headers. Wrap the "Why This Matters" or key takeaway inside a <blockquote>...</blockquote> blockquote tag.
4. PERSONALIZATION & RELEVANCE: Always tailor explanations specifically to a ${occupation} interested in ${interests} and ${industries}.
5. CONCISE & HIGH IMPACT: Keep responses crisp, structured, and easy to skim on mobile screens using bullet points and emojis.
6. CRITICAL HTML RULE: Only output valid Telegram HTML tags (<b>, <i>, <code>, <blockquote>). Do not wrap responses in markdown code blocks (\`\`\`html) and escape raw ampersands as &amp;.`;
}

/**
 * Full AI chat pipeline execution
 * @param {string|number} telegramId
 * @param {string} userMessage
 */
export async function getChatResponse(telegramId, userMessage) {
  try {
    const openai = getOpenAIClient();

    const preference = await getPreference(telegramId);
    const history = await getRecentMessages(telegramId, 20);
    const recentNews = await getRecentNews(3, 15);

    const systemPrompt = buildSystemPrompt(preference, recentNews);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

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

/**
 * Generate a personalized briefing for a user based on their preference profile
 * @param {Object} preference
 */
export async function generatePersonalizedBriefing(preference) {
  try {
    const openai = getOpenAIClient();
    const recentNews = await getRecentNews(3, 15);

    const systemPrompt = buildSystemPrompt(preference, recentNews);

    const prompt =
      `Generate a premium, structured Financial Briefing formatted using Telegram HTML.\n\n` +
      `Use this exact layout:\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 <b>ATLAS DAILY MARKET BRIEFING</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🌅 <b>Top Market Highlights</b>\n` +
      `• Highlight 1...\n` +
      `• Highlight 2...\n\n` +
      `<blockquote>⚡ <b>Why This Matters to a ${preference?.occupation || 'Professional'}:</b>\nExplain practical impact...</blockquote>\n\n` +
      `🎯 <b>Industry Focus (${preference?.industries || 'General'})</b>\n` +
      `• Industry insight...\n\n` +
      `─────────────────────────\n` +
      `<i>Updated for ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • Atlas AI</i>`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 750,
    });

    return completion.choices[0]?.message?.content || "📊 <b>Atlas Daily Briefing</b>\nNo new briefing updates at this time.";
  } catch (error) {
    console.error('[AIService] Error generating personalized briefing:', error);
    return "📊 <b>Atlas Daily Briefing</b>\n⚠️ Unable to generate briefing at this moment.";
  }
}

export default {
  buildSystemPrompt,
  getChatResponse,
  generatePersonalizedBriefing,
};
