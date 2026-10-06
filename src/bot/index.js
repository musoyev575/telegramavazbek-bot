/**
 * Telegram botini yaratish va ishga tushirish.
 * Middleware tartibi muhim: xatoliklarni ushlash → rate limit → sessiya → foydalanuvchi → handlerlar.
 */
import { Telegraf } from 'telegraf';
import config, { assertBotToken } from '../config/index.js';
import logger from '../utils/logger.js';
import { sessionMiddleware } from './middlewares/session.js';
import userLoader from './middlewares/userLoader.js';
import rateLimitMiddleware from './middlewares/rateLimit.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { registerHandlers } from './handlers/index.js';
import { setTelegram } from './notifications.js';
import { markBotStarted, markBotStopped, markUpdate } from './status.js';

const log = logger.with('bot');

const COMMANDS = [
  { command: 'start', description: 'Boshlash / asosiy menyu' },
  { command: 'katalog', description: 'Telefonlar katalogi' },
  { command: 'qidiruv', description: 'Telefon qidirish' },
  { command: 'buyurtmalarim', description: 'Mening buyurtmalarim' },
  { command: 'sevimlilar', description: 'Sevimli telefonlarim' },
  { command: 'help', description: 'Yordam' },
  { command: 'admin', description: 'Administrator bo‘limi' },
];

/**
 * Bot instansiyasini yaratadi (tarmoqqa ulanmaydi — testlar uchun ham xavfsiz).
 * @param {string} [token]
 */
export function createBot(token = config.botToken) {
  if (!token) throw new Error('Bot tokeni berilmagan');
  const bot = new Telegraf(token, { handlerTimeout: 90_000 });

  bot.use(errorHandler);
  // Har bir update — "jarayon tirik" isboti (monitoring uchun)
  bot.use((_ctx, next) => {
    markUpdate();
    return next();
  });
  bot.use(rateLimitMiddleware);
  bot.use(sessionMiddleware);
  bot.use(userLoader);
  registerHandlers(bot);

  return bot;
}

/** Buyruqlar ro'yxatini Telegram'ga yozadi va botni ishga tushiradi */
export async function startBot(bot) {
  assertBotToken();

  try {
    await bot.telegram.setMyCommands(COMMANDS);
  } catch (error) {
    log.warn('Buyruqlar ro‘yxatini o‘rnatib bo‘lmadi', error?.response?.description ?? error);
  }

  setTelegram(bot.telegram);

  // MUHIM: `bot.launch()` long-polling tsikliga o'tadi va HECH QACHON resolve bo'lmaydi.
  // Uni `await` qilish butun ilovani to'xtatib qo'yadi (admin panel ishga tushmaydi),
  // shuning uchun promisni kutmasdan ishga tushiramiz va xatolarni ushlaymiz.
  bot
    .launch({ dropPendingUpdates: true }, () => {
      const me = bot.botInfo;
      markBotStarted(me);
      log.info(`Bot ishga tushdi: @${me?.username ?? 'unknown'} (${me?.id ?? '?'})`);
    })
    .catch((error) => {
      const reason = error?.response?.description ?? error?.message ?? String(error);
      log.error('Botni ishga tushirishda xatolik — jarayon to‘xtatiladi', reason);
      markBotStopped(reason);

      // 24/7 ishlash: bot o'lgan jarayon tirik qolmasligi kerak. Nol bo'lmagan kod bilan
      // chiqamiz — systemd/PM2 jarayonni avtomatik qayta uradi (Restart=always).
      // Aks holda admin panel ishlab turadi, bot esa jimgina o'lik bo'lib qoladi.
      setTimeout(() => process.exit(1), 500);
    });

  return bot;
}

/** Botni to'xtatish (graceful shutdown) */
export function stopBot(bot, reason = 'signal') {
  try {
    bot.stop(reason);
    markBotStopped(reason);
    log.info('Bot to‘xtatildi');
  } catch (error) {
    log.warn('Botni to‘xtatishda xatolik', error);
  }
}

export default { createBot, startBot, stopBot, COMMANDS };
