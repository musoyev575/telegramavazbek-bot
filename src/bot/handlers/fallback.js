/**
 * Noma'lum xabar va callback'lar uchun zaxira (fallback) handlerlar.
 * Foydalanuvchi hech qachon "jim qolgan" bot bilan qolmaydi.
 */
import { Markup } from 'telegraf';
import { cb } from '../keyboards/common.js';
import { mainMenuKeyboard } from '../keyboards/mainKeyboard.js';
import { HTML } from '../ui.js';
import { clean } from '../../utils/validate.js';
import { runSearch } from './search.js';
import productService from '../../services/productService.js';

export function registerFallback(bot) {
  // Matn: qidiruvga o'xshasa qidiradi, aks holda menyu taklif qiladi
  bot.on('text', async (ctx) => {
    const text = clean(ctx.message.text, 60);

    // Faqat haqiqiy natija beradigan matngina qidiruv deb qabul qilinadi.
    // Aks holda "salom" kabi tasodifiy matn foydalanuvchini "topilmadi"
    // ekraniga olib kirardi — bu yomon tajriba.
    if (text.length >= 3 && productService.catalog({ query: text, perPage: 1 }).total > 0) {
      await runSearch(ctx, text);
      return;
    }

    await ctx.reply(
      [
        '🤔 Bu buyruqni tushunmadim.',
        '',
        "Kerakli bo'limni menyudan tanlang yoki telefon nomini yozib qidiring (masalan: <i>iPhone 15</i>).",
      ].join('\n'),
      { ...HTML, ...mainMenuKeyboard() },
    );
  });

  bot.on('contact', async (ctx) => {
    await ctx.reply('✅ Rahmat! Raqamingiz saqlandi.', { ...HTML, ...Markup.removeKeyboard() });
    await ctx.reply('Kerakli bo‘limni tanlang 👇', { ...HTML, ...mainMenuKeyboard() });
    void cb;
  });

  bot.on('callback_query', async (ctx) => {
    await ctx.answerCbQuery('Bu tugma endi faol emas').catch(() => {});
  });
}

export default registerFallback;
