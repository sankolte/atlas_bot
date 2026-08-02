import express from 'express';
import config from './config/env.js';
import bot from './bot/bot.js';
import initNewsFetchJob from './jobs/fetchNews.job.js';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

const PORT = config.port || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize hourly news ingestion cron job
  initNewsFetchJob();

  try {
    await bot.launch();
    console.log('Atlas Telegram bot launched successfully (polling mode)');
  } catch (err) {
    console.error('Failed to launch Telegram bot:', err);
  }
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default app;
