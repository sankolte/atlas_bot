import Parser from 'rss-parser';
import prisma from '../db/prisma.js';

const parser = new Parser();

/**
 * Fetch and ingest articles from a single RSS feed URL
 * @param {string} feedUrl
 */
export async function fetchRssFeed(feedUrl) {
  try {
    const feed = await parser.parseURL(feedUrl);
    let insertedCount = 0;

    for (const item of feed.items || []) {
      const url = item.link || item.guid;
      if (!url) continue;

      const existing = await prisma.newsItem.findUnique({
        where: { sourceUrl: url },
      });

      if (!existing) {
        await prisma.newsItem.create({
          data: {
            title: item.title || 'RSS Financial News',
            summary: item.contentSnippet || item.content || item.title || '',
            category: feed.title || 'RSS Feed',
            sourceUrl: url,
            publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
          },
        });
        insertedCount++;
      }
    }

    return { title: feed.title, inserted: insertedCount, total: feed.items.length };
  } catch (error) {
    console.error(`[RssService] Error fetching feed ${feedUrl}:`, error.message);
    throw error;
  }
}

/**
 * Add a custom RSS feed for a user
 * @param {string|number} telegramId
 * @param {string} feedUrl
 */
export async function addUserFeed(telegramId, feedUrl) {
  const strId = String(telegramId);

  const user = await prisma.user.findUnique({
    where: { telegramId: strId },
  });

  if (!user) throw new Error('User not found');

  // Verify feed works
  const feedData = await fetchRssFeed(feedUrl);

  const feedRecord = await prisma.userFeed.upsert({
    where: {
      userId_feedUrl: {
        userId: user.id,
        feedUrl,
      },
    },
    update: { title: feedData.title },
    create: {
      userId: user.id,
      feedUrl,
      title: feedData.title || feedUrl,
    },
  });

  return { feed: feedRecord, insertedArticles: feedData.inserted };
}

/**
 * Get all registered custom feeds for a user
 * @param {string|number} telegramId
 */
export async function getUserFeeds(telegramId) {
  const strId = String(telegramId);
  const user = await prisma.user.findUnique({
    where: { telegramId: strId },
    include: { feeds: true },
  });

  return user ? user.feeds : [];
}

/**
 * Remove a custom RSS feed for a user
 * @param {string|number} telegramId
 * @param {string} feedId
 */
export async function removeUserFeed(telegramId, feedId) {
  const strId = String(telegramId);
  const user = await prisma.user.findUnique({
    where: { telegramId: strId },
  });

  if (!user) return false;

  await prisma.userFeed.deleteMany({
    where: {
      id: feedId,
      userId: user.id,
    },
  });

  return true;
}

/**
 * Ingest all user-added custom RSS feeds across the system
 */
export async function fetchAllUserFeeds() {
  const feeds = await prisma.userFeed.findMany();
  console.log(`[RssService] Ingesting ${feeds.length} custom user RSS feeds...`);

  let totalInserted = 0;
  for (const feed of feeds) {
    try {
      const res = await fetchRssFeed(feed.feedUrl);
      totalInserted += res.inserted;
    } catch (e) {
      console.warn(`[RssService] Failed feed ${feed.feedUrl}:`, e.message);
    }
  }

  return totalInserted;
}

export default {
  fetchRssFeed,
  addUserFeed,
  getUserFeeds,
  removeUserFeed,
  fetchAllUserFeeds,
};
