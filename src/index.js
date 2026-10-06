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
import { hashSync } from 'bcryptjs';
import adminModel from './models/adminModel.js';
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

  // VAQTINCHALIK: parolni tiklash. RESET_ADMIN_PASSWORD o'zgaruvchisi berilsa, bosh administrator
  // paroli shunga almashadi. Kirgach, bu o'zgaruvchini O'CHIRIB tashlang!
  const resetPassword = (process.env.RESET_ADMIN_PASSWORD || '').trim();
  if (resetPassword) {
    const admin = adminModel.findByUsername(config.seed.adminUsername) ?? adminModel.list()[0];
    if (!admin) {
      log.warn('Parolni tiklash: administrator topilmadi');
    } else if (resetPassword.length < 8) {
      log.warn('Parolni tiklash: yangi parol kamida 8 belgi bo‘lishi kerak');
    } else {
      adminModel.setPassword(admin.id, hashSync(resetPassword, 12));
      adminModel.deleteSessionsForAdmin(admin.id);
      log.warn(`Parolni tiklash bajarildi. Login: "${admin.username}". RESET_ADMIN_PASSWORD ni o'chiring!`);
    }
  }

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
