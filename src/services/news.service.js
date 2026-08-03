import axios from 'axios';
import config from '../config/env.js';
import prisma from '../db/prisma.js';

/**
 * Fetch latest financial news from Marketaux API and insert deduped items into DB
 */
export async function fetchLatestNews() {
  const apiKey = config.newsApiKey;

  if (!apiKey || apiKey.includes('your_') || apiKey.includes('here')) {
    console.warn('[NewsService] NEWS_API_KEY is not configured in .env. Skipping news fetch.');
    return { fetched: 0, inserted: 0 };
  }

  try {
    const response = await axios.get('https://api.marketaux.com/v1/news/all', {
      params: {
        language: 'en',
        must_have_entities: true,
        filter_entities: true,
        limit: 50,
        api_token: apiKey,
      },
      timeout: 10000,
    });

    const articles = response.data?.data || [];
    let insertedCount = 0;

    for (const article of articles) {
      const url = article.url;
      if (!url) continue;

      // Check if already exists in DB by sourceUrl
      const existing = await prisma.newsItem.findUnique({
        where: { sourceUrl: url },
      });

      if (!existing) {
        const companyName =
          article.entities && article.entities.length > 0
            ? article.entities[0].name
            : null;

        const categoryName =
          article.categories && article.categories.length > 0
            ? String(article.categories[0])
            : article.entities && article.entities.length > 0 && article.entities[0].industry
            ? article.entities[0].industry
            : 'Finance';

        await prisma.newsItem.create({
          data: {
            title: article.title || 'Untitled Financial News',
            summary: article.description || article.snippet || article.title || '',
            company: companyName,
            category: categoryName,
            sourceUrl: url,
            publishedAt: article.published_at ? new Date(article.published_at) : new Date(),
          },
        });

        insertedCount++;
      }
    }

    console.log(`[NewsService] Ingestion complete. Total fetched: ${articles.length}, Newly inserted: ${insertedCount}`);
    return { fetched: articles.length, inserted: insertedCount };
  } catch (error) {
    console.error('[NewsService] Error fetching news:', error.response?.data || error.message);
    return { fetched: 0, inserted: 0, error: error.message };
  }
}

/**
 * Get recent news items for prompt context (e.g. last 3 days)
 */
export async function getRecentNews(days = 3, limit = 15) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return await prisma.newsItem.findMany({
    where: {
      publishedAt: {
        gte: cutoff,
      },
    },
    orderBy: {
      publishedAt: 'desc',
    },
    take: limit,
  });
}

export default {
  fetchLatestNews,
  getRecentNews,
};
