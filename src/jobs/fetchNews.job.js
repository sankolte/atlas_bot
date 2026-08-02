import cron from 'node-cron';
import { fetchLatestNews } from '../services/news.service.js';
import { fetchAllUserFeeds } from '../services/rss.service.js';

/**
 * Initialize hourly news & custom RSS feed ingestion cron job
 */
export function initNewsFetchJob() {
  console.log('[Cron Job] Initializing hourly news & RSS ingestion cron job (0 * * * *)...');

  const task = cron.schedule('0 * * * *', async () => {
    console.log('[Cron Job] Running scheduled hourly financial news & RSS fetch...');
    try {
      const result = await fetchLatestNews();
      const rssInserted = await fetchAllUserFeeds();
      console.log(`[Cron Job] Completed hourly fetch. Marketaux: ${result.inserted}, RSS: ${rssInserted} items.`);
    } catch (err) {
      console.error('[Cron Job] Error during news fetch job:', err);
    }
  });

  // Run immediately on startup once as well
  fetchLatestNews()
    .then(async (result) => {
      const rssInserted = await fetchAllUserFeeds().catch(() => 0);
      console.log(`[Cron Job] Initial startup news fetch complete. Marketaux: ${result.inserted}, RSS: ${rssInserted}`);
    })
    .catch((err) => {
      console.error('[Cron Job] Initial news fetch failed:', err.message);
    });

  return task;
}

export default initNewsFetchJob;
