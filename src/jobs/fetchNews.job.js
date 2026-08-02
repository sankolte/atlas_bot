import cron from 'node-cron';
import { fetchLatestNews } from '../services/news.service.js';

/**
 * Initialize hourly news ingestion cron job
 */
export function initNewsFetchJob() {
  console.log('[Cron Job] Initializing hourly news ingestion cron job (0 * * * *)...');

  // Schedule to run at the start of every hour: '0 * * * *'
  const task = cron.schedule('0 * * * *', async () => {
    console.log('[Cron Job] Running scheduled hourly financial news fetch...');
    try {
      const result = await fetchLatestNews();
      console.log(`[Cron Job] Completed hourly fetch. Inserted: ${result.inserted} news items.`);
    } catch (err) {
      console.error('[Cron Job] Error during news fetch job:', err);
    }
  });

  // Run immediately on startup once as well
  fetchLatestNews()
    .then((result) => {
      console.log(`[Cron Job] Initial startup news fetch complete. Newly inserted: ${result.inserted}`);
    })
    .catch((err) => {
      console.error('[Cron Job] Initial news fetch failed:', err.message);
    });

  return task;
}

export default initNewsFetchJob;
