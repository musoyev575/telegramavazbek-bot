/**
 * Ilovaning kirish nuqtasi: ma'lumotlar bazasi → seed → bot + admin panel.
 *
 * Ishga tushirish:
 *   npm start            -> bot + admin panel
 *   npm run bot          -> faqat bot
 *   npm run admin        -> faqat admin panel (bot tokeni kerak emas)
 */
import config from './config/index.js';
import logger from './utils/logger.js';
import { closeDb } from './database/db.js';
import { seedIfEmpty } from './database/seed.js';
import { createBot, startBot, stopBot } from './bot/index.js';
import { createAdminServer } from './admin/server.js';

const args = process.argv.slice(2);
const botOnly = args.includes('--bot-only');
const adminOnly = args.includes('--admin-only');
const log = logger.with('main');

async function main() {
  log.info(`Ishga tushirilmoqda (muhit: ${config.env})`);

  // 1) Baza va boshlang'ich ma'lumotlar
  seedIfEmpty();

  const running = { bot: null, server: null };

  // 2) Telegram bot
  if (!adminOnly) {
    const bot = createBot();
    await startBot(bot);
    running.bot = bot;
  } else {
    log.info("Admin-only rejim: bot ishga tushirilmaydi (BOT_TOKEN talab qilinmaydi)");
  }

  // 3) Admin web panel
  if (!botOnly) {
    const app = createAdminServer();
    running.server = app.listen(config.admin.port, config.admin.host, () => {
      log.info(`Admin panel: http://${config.admin.host}:${config.admin.port}`);
    });
    running.server.on('error', (error) => {
      log.error('Admin panelni ishga tushirishda xatolik', error);
    });
  }

  // 4) Graceful shutdown
  const shutdown = (signal) => {
    log.info(`${signal} qabul qilindi — to'xtatilmoqda...`);
    if (running.bot) stopBot(running.bot, signal);
    if (running.server) running.server.close();
    closeDb();
    setTimeout(() => process.exit(0), 300);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return running;
}

main().catch((error) => {
  logger.error('Ilovani ishga tushirishda xatolik', error);
  process.exit(1);
});
