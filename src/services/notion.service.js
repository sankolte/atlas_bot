import { Client } from '@notionhq/client';
import prisma from '../db/prisma.js';

/**
 * Save user's Notion Integration Token & Database ID (with auto discovery)
 * @param {string|number} telegramId
 * @param {string} notionApiKey
 * @param {string} [notionDatabaseId]
 */
export async function saveNotionConfig(telegramId, notionApiKey, notionDatabaseId = null) {
  const strId = String(telegramId);

  const user = await prisma.user.findUnique({
    where: { telegramId: strId },
  });

  if (!user) throw new Error('User not found');

  const notion = new Client({ auth: notionApiKey });
  let targetDbId = notionDatabaseId;

  // Search all shared pages/databases in Notion workspace without invalid filter
  if (!targetDbId) {
    const searchRes = await notion.search({
      query: '',
      page_size: 20,
    });

    const results = searchRes.results || [];
    const databaseItem = results.find((item) => item.object === 'database');
    const pageItem = results.find((item) => item.object === 'page');

    if (databaseItem) {
      targetDbId = databaseItem.id;
    } else if (pageItem) {
      targetDbId = pageItem.id;
    } else {
      throw new Error(
        'No shared page or database found. Please open your Notion page/database ➔ click ••• (top right) ➔ Add connections ➔ select your integration.'
      );
    }
  } else {
    targetDbId = targetDbId.replace(/[^a-zA-Z0-9]/g, '');
  }

  await prisma.preference.update({
    where: { userId: user.id },
    data: {
      notionApiKey,
      notionDatabaseId: targetDbId,
    },
  });

  return { databaseId: targetDbId };
}

/**
 * Push a financial briefing or research note into user's Notion database/page
 * @param {string|number} telegramId
 * @param {string} title
 * @param {string} content
 */
export async function pushBriefingToNotion(telegramId, title, content) {
  const strId = String(telegramId);

  const user = await prisma.user.findUnique({
    where: { telegramId: strId },
    include: { preference: true },
  });

  if (!user || !user.preference || !user.preference.notionApiKey || !user.preference.notionDatabaseId) {
    throw new Error('Notion integration is not configured. Please use /notion to connect your workspace.');
  }

  const { notionApiKey, notionDatabaseId } = user.preference;
  const notion = new Client({ auth: notionApiKey });

  // Clean HTML/Markdown tags for Notion plain text blocks
  const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\*/g, '');

  const lines = cleanContent.split('\n').filter((line) => line.trim().length > 0);
  const childrenBlocks = lines.map((line) => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: line.length > 2000 ? line.substring(0, 1995) + '...' : line,
          },
        },
      ],
    },
  }));

  const titleProp = {
    title: [
      {
        text: {
          content: title || `Atlas Briefing - ${new Date().toLocaleDateString()}`,
        },
      },
    ],
  };

  // Try creating as sub-page inside database or parent page
  try {
    return await notion.pages.create({
      parent: { database_id: notionDatabaseId },
      properties: titleProp,
      children: childrenBlocks.slice(0, 90),
    });
  } catch (err) {
    // Fallback if target ID is a Page ID instead of a Database ID
    return await notion.pages.create({
      parent: { page_id: notionDatabaseId },
      properties: titleProp,
      children: childrenBlocks.slice(0, 90),
    });
  }
}

export default {
  saveNotionConfig,
  pushBriefingToNotion,
};
