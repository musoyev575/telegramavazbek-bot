/**
 * Admin huquqini tekshirish (bot tomoni).
 * Faqat `admins` jadvalida telegram_id si bor va faol administrator o'tadi.
 */
import adminModel from '../../models/adminModel.js';
import { adminDenied } from '../texts.js';

export function adminGuard(options = {}) {
  const { silent = false } = options;

  return async function guard(ctx, next) {
    const telegramId = ctx.from?.id;
    const admin = telegramId ? adminModel.findByTelegramId(telegramId) : null;

    if (!admin) {
      if (!silent) {
        if (ctx.callbackQuery) await ctx.answerCbQuery('⛔ Ruxsat yo‘q').catch(() => {});
        else await ctx.reply(adminDenied()).catch(() => {});
      }
      return undefined;
    }

    ctx.state.admin = admin;
    return next();
  };
}

/** Middlewaresiz tekshirish (handler ichida) */
export function getAdmin(ctx) {
  const telegramId = ctx.from?.id;
  return telegramId ? adminModel.findByTelegramId(telegramId) : null;
}

export function isAdmin(ctx) {
  return Boolean(getAdmin(ctx));
}

export default { adminGuard, getAdmin, isAdmin };
