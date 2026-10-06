/**
 * /start, /help va asosiy menyu navigatsiyasi.
 */
import { Markup } from 'telegraf';
import { cb } from '../keyboards/common.js';
import { mainMenuKeyboard } from '../keyboards/mainKeyboard.js';
import { mainMenu, helpText } from '../texts.js';
import { editOrSend, HTML } from '../ui.js';
import { resetFlow } from '../middlewares/session.js';
import { MENU } from '../../config/constants.js';
import cartService from '../../services/cartService.js';
import { isAdmin } from '../middlewares/adminGuard.js';

export function registerStart(bot) {
  bot.start(async (ctx) => {
    resetFlow(ctx);
    const user = ctx.state.user;

    await ctx.reply(mainMenu(user), { ...HTML, ...mainMenuKeyboard() });

    // Savatchada mahsulot bo'lsa — qisqa eslatma
    const count = cartService.count(user.id);
    const rows = [];
    if (count > 0) rows.push([cb(`🛒 Savatchada ${count} ta mahsulot`, 'cart:open')]);
    if (isAdmin(ctx)) rows.push([cb('🛠 Administrator bo‘limi', 'admin:menu')]);
    if (rows.length) {
      await ctx.reply('Davom etamizmi?', Markup.inlineKeyboard(rows));
    }
  });

  bot.help(async (ctx) => {
    await editOrSend(ctx, helpText(), mainMenuKeyboard());
  });

  bot.hears(MENU.HELP, async (ctx) => {
    await editOrSend(ctx, helpText(), mainMenuKeyboard());
  });

  // --- Umumiy navigatsiya ---
  bot.action('nav:menu', async (ctx) => {
    resetFlow(ctx);
    await ctx.answerCbQuery();
    await editOrSend(ctx, mainMenu(ctx.state.user), mainMenuKeyboard());
  });

  bot.action('nav:cancel', async (ctx) => {
    resetFlow(ctx);
    await ctx.answerCbQuery('Bekor qilindi');
    await editOrSend(ctx, '❌ Amal bekor qilindi.\n\nKerakli bo‘limni tanlang 👇', mainMenuKeyboard());
  });

  bot.action('nav:noop', async (ctx) => {
    await ctx.answerCbQuery();
  });
}

export default registerStart;
