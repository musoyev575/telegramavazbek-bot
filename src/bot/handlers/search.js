/**
 * Qidiruv: telefon nomi, brendi yoki modeli bo'yicha.
 * Foydalanuvchi matn yozadi — handler `handlers/index.js` dagi matn routeri orqali keladi.
 */
import { cancelButton } from '../keyboards/common.js';
import { Markup } from 'telegraf';
import { searchPrompt } from '../texts.js';
import { HTML } from '../ui.js';
import { resetFlow } from '../middlewares/session.js';
import { showCatalog } from './catalog.js';
import { MENU } from '../../config/constants.js';
import { clean } from '../../utils/validate.js';

/** Qidiruv oqimini boshlash */
export async function startSearch(ctx) {
  ctx.session.flow = 'search';
  ctx.session.data = {};
  await ctx.reply(searchPrompt(), {
    ...HTML,
    ...Markup.inlineKeyboard([[cancelButton()]]),
  });
}

/** Qidiruv so'rovini bajarish (matn routeridan chaqiriladi) */
export async function runSearch(ctx, rawQuery) {
  const query = clean(rawQuery, 60);
  if (query.length < 2) {
    await ctx.reply('✍️ Kamida 2 belgi kiriting.');
    return false;
  }

  resetFlow(ctx);
  ctx.session.catalog = {
    ...ctx.session.catalog,
    query,
    brand: null,
    page: 1,
  };

  await showCatalog(ctx, { edit: false });
  return true;
}

export function registerSearch(bot) {
  bot.hears(MENU.SEARCH, startSearch);

  bot.command('qidiruv', async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if (!query) {
      await startSearch(ctx);
      return;
    }
    await runSearch(ctx, query);
  });
}

export default registerSearch;
