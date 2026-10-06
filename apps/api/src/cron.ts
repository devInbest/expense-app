/**
 * Entry point for the Render cron job (every 15 minutes). Runs every job once and exits.
 * Usage: `pnpm cron` (all jobs) or `pnpm cron recurring stats` (selected jobs).
 */
import { connectDatabase, disconnectDatabase } from './config/database';
import { JOBS, runAllJobs } from './jobs';

const main = async () => {
  await connectDatabase();
  const selected = process.argv.slice(2);
  if (selected.length === 0) {
    await runAllJobs();
  } else {
    for (const name of selected) {
      const job = JOBS[name];
      if (!job) {
        console.error(`Unknown job "${name}". Available: ${Object.keys(JOBS).join(', ')}`);
        continue;
      }
      console.log(`[job:${name}]`, await job());
    }
  }
  await disconnectDatabase();
};

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
