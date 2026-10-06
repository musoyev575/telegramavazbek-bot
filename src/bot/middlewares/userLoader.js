/**
 * Har bir yangilanishda foydalanuvchini bazaga yozadi (ro'yxatdan o'tkazish)
 * va `ctx.state.user` ga biriktiradi. Bloklangan foydalanuvchilar e'tiborsiz qoldiriladi.
 */
import userModel from '../../models/userModel.js';
import logger from '../../utils/logger.js';

export async function userLoader(ctx, next) {
  const from = ctx.from;
  if (!from || from.is_bot) return next();

  try {
    const user = userModel.upsertFromTelegram(from);
    if (user.is_blocked) {
      // Bloklangan foydalanuvchi bilan muloqot qilmaymiz (faqat bir marta xabar)
      if (ctx.message) await ctx.reply('⛔ Hisobingiz bloklangan. Do‘kon bilan bog‘laning.');
      return undefined;
    }
    ctx.state.user = user;
  } catch (error) {
    logger.error('Foydalanuvchini yuklashda xatolik', error);
  }

  return next();
}

export default userLoader;
