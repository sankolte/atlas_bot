/**
 * Utility functions for formatting, sanitizing, and handling Telegram HTML messages.
 */

/**
 * Supported Telegram HTML tags (casing normalized to lowercase)
 */
const SUPPORTED_TAGS = new Set([
  'b', 'strong',
  'i', 'em',
  'u', 'ins',
  's', 'strike', 'del',
  'blockquote',
  'code',
  'pre',
  'a',
  'tg-spoiler'
]);

/**
 * Sanitize and format raw text/HTML from AI model for Telegram HTML parse mode.
 * - Strips code block wrappers (e.g. ```html ... ```)
 * - Converts non-Telegram block tags (<p>, <br>, <h1>) to clean line breaks and bold styling
 * - Escapes unescaped '&' as '&amp;'
 * - Escapes unsupported '<' and '>' as '&lt;' and '&gt;'
 * - Balances unclosed Telegram HTML tags to prevent 400 Bad Request parsing errors
 *
 * @param {string} text
 * @returns {string} Sanitized HTML string safe for Telegram replyWithHTML / parse_mode: 'HTML'
 */
export function sanitizeTelegramHtml(text) {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // 1. Remove markdown code block wrappers around entire HTML response (e.g. ```html ... ```)
  sanitized = sanitized
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '');

  // 2. Convert common non-Telegram block tags to clean plain/bold text
  sanitized = sanitized
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h[1-6]>/gi, '\n<b>')
    .replace(/<\/h[1-6]>/gi, '</b>\n');

  // 3. Replace unescaped ampersands ('&' not part of &amp;, &lt;, &gt;, &quot;, &apos;, or &#...;)
  sanitized = sanitized.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/g, '&amp;');

  // 4. Tokenize and protect valid Telegram HTML tags
  const validTagRegex = /<\/?(b|strong|i|em|u|ins|s|strike|del|blockquote|code|pre|a|tg-spoiler)(\s+[^>]*)?>/gi;
  const tokens = [];

  sanitized = sanitized.replace(validTagRegex, (match) => {
    tokens.push(match);
    return `___TELEGRAM_TAG_TOKEN_${tokens.length - 1}___`;
  });

  // 5. Escape remaining raw '<' and '>' symbols that are not valid tags
  sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 6. Restore valid tags
  tokens.forEach((tag, idx) => {
    sanitized = sanitized.replace(`___TELEGRAM_TAG_TOKEN_${idx}___`, tag);
  });

  // 7. Balance unclosed tags
  sanitized = balanceTelegramHtmlTags(sanitized);

  return sanitized;
}

/**
 * Balance unclosed HTML tags for Telegram
 * @param {string} html
 * @returns {string}
 */
function balanceTelegramHtmlTags(html) {
  const stack = [];
  const tagRegex = /<\/?([a-z0-9-]+)(\s+[^>]*)?>/gi;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = match[0].startsWith('</');
    const tagName = match[1].toLowerCase();

    if (!SUPPORTED_TAGS.has(tagName)) continue;

    if (!isClosing) {
      stack.push(tagName);
    } else {
      const lastIndex = stack.lastIndexOf(tagName);
      if (lastIndex !== -1) {
        stack.splice(lastIndex);
      }
    }
  }

  while (stack.length > 0) {
    const unclosedTag = stack.pop();
    html += `</${unclosedTag}>`;
  }

  return html;
}

/**
 * Strip all HTML tags and decode entities for clean plain-text fallbacks
 * @param {string} text
 * @returns {string} Plain text without raw HTML tags
 */
export function stripHtml(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, p1) => {
      const lines = p1.trim().split('\n').map((l) => `> ${l}`).join('\n');
      return `\n${lines}\n`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export default {
  sanitizeTelegramHtml,
  stripHtml,
};
