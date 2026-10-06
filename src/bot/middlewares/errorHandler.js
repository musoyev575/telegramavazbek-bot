/**
 * Xatoliklarni markazlashtirilgan ushlash.
 * Foydalanuvchiga tushunarli xabar, loglarga esa to'liq tafsilot yoziladi.
 */
import logger from '../../utils/logger.js';
import { errorText } from '../texts.js';

export async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (error) {
    logger.error(`Bot xatoligi (update ${ctx.updateType})`, error);

    const description = error?.response?.description;
    if (description?.includes('message is not modified')) return; // Telegram'ning zararsiz ogohlantirishi

    try {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('⚠️ Xatolik yuz berdi').catch(() => {});
      } else if (ctx.chat) {
        await ctx.reply(errorText()).catch(() => {});
      }
    } catch {
      /* foydalanuvchiga xabar yuborib bo'lmasa ham bot ishlashda davom etadi */
    }
  }
}

export default errorHandler;
