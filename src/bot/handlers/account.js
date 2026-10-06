/**
 * Sevimlilar, bog'lanish va do'kon manzili bo'limlari.
 */
import { Markup } from 'telegraf';
import { cb } from '../keyboards/common.js';
import { addressText, contactText, favoritesListText, favoritesText } from '../texts.js';
import { editOrSend } from '../ui.js';
import favoriteModel from '../../models/favoriteModel.js';
import productService from '../../services/productService.js';
import { MENU } from '../../config/constants.js';

/** Sevimlilar ro'yxatini ko'rsatadi */
export async function showFavorites(ctx, { edit = true } = {}) {
  const products = favoriteModel.list(ctx.state.user.id);

  if (products.length === 0) {
    const keyboard = Markup.inlineKeyboard([
      [cb('📱 Katalog', 'catalog:open')],
      [cb('🏠 Asosiy menyu', 'nav:menu')],
    ]);
    const text = favoritesText([]);
    if (edit) await editOrSend(ctx, text, { ...keyboard });
    else await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
    return;
  }

  const rows = products.map((product, index) => [
    cb(`⭐️ ${index + 1}. ${product.brand} ${product.model}`, `product:open:${product.id}`),
  ]);
  rows.push([cb('🏠 Asosiy menyu', 'nav:menu')]);

  const text = favoritesListText(products);
  if (edit) await editOrSend(ctx, text, { ...Markup.inlineKeyboard(rows) });
  else await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
}

export function registerAccount(bot) {
  bot.hears(MENU.FAVORITES, async (ctx) => {
    ctx.session.flow = null;
    await showFavorites(ctx, { edit: false });
  });

  bot.command('sevimlilar', async (ctx) => {
    ctx.session.flow = null;
    await showFavorites(ctx, { edit: false });
  });

  bot.action('favorites:open', async (ctx) => {
    await ctx.answerCbQuery();
    await showFavorites(ctx);
  });

  bot.hears(MENU.CONTACT, async (ctx) => {
    ctx.session.flow = null;
    const shop = productService.shopInfo();
    const rows = [];
    if (shop.phone) rows.push([cb('📞 Operator bilan bog‘lanish', 'contact:call')]);
    rows.push([cb('🏠 Asosiy menyu', 'nav:menu')]);
    await ctx.reply(contactText(), { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
  });

  bot.action('contact:open', async (ctx) => {
    const shop = productService.shopInfo();
    await ctx.answerCbQuery();
    await editOrSend(ctx, contactText(), {
      ...Markup.inlineKeyboard([
        [cb('📞 Operator bilan bog‘lanish', 'contact:call')],
        [cb('🏠 Asosiy menyu', 'nav:menu')],
      ]),
    });
    void shop;
  });

  bot.action('contact:call', async (ctx) => {
    const shop = productService.shopInfo();
    await ctx.answerCbQuery();
    await ctx.reply(`${shop.phone}\n\n<i>${shop.support}</i>`, { parse_mode: 'HTML' });
  });

  bot.hears(MENU.ADDRESS, async (ctx) => {
    ctx.session.flow = null;
    const shop = productService.shopInfo();
    const rows = [];
    if (shop.mapUrl) rows.push([Markup.button.url('🗺 Xaritada ochish', shop.mapUrl)]);
    rows.push([cb('🏠 Asosiy menyu', 'nav:menu')]);
    await ctx.reply(addressText(), { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
  });
}

export default registerAccount;
