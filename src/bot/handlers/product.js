/**
 * Telefon sahifasi: to'liq ma'lumot, savatchaga qo'shish, darhol sotib olish, sevimlilar.
 */
import { Markup } from 'telegraf';
import { addedToCartKeyboard, productKeyboard } from '../keyboards/productKeyboard.js';
import { cb } from '../keyboards/common.js';
import { productDetails } from '../texts.js';
import { editOrSend, sendProductCard, HTML } from '../ui.js';
import productService from '../../services/productService.js';
import cartService from '../../services/cartService.js';
import favoriteModel from '../../models/favoriteModel.js';
import { startCheckout } from './checkout.js';

const BACK_ACTION = 'catalog:open';

/** Mahsulot sahifasini ko'rsatadi (yangi xabar sifatida — rasm bilan) */
export async function showProduct(ctx, productId) {
  const product = productService.getProduct(productId);
  if (!product) {
    await editOrSend(ctx, '😕 Bu telefon topilmadi yoki sotuvdan olingan.');
    return null;
  }

  ctx.session.lastProductId = product.id;
  const userId = ctx.state.user.id;

  const caption = productDetails(product);
  const keyboard = productKeyboard({
    product,
    inStock: product.stock > 0,
    isFavorite: favoriteModel.isFavorite(userId, product.id),
    backAction: BACK_ACTION,
  });

  await sendProductCard(ctx, { caption, image: product.image, keyboard });
  return product;
}

export function registerProduct(bot) {
  bot.action(/^product:open:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await showProduct(ctx, Number(ctx.match[1]));
  });

  // Savatchaga qo'shish
  bot.action(/^product:add:(\d+)$/, async (ctx) => {
    const productId = Number(ctx.match[1]);
    const result = cartService.addItem(ctx.state.user.id, productId);

    if (!result.ok) {
      const message =
        result.reason === 'out_of_stock'
          ? '❌ Hozirda mahsulot mavjud emas'
          : result.reason === 'not_enough_stock'
            ? `⚠️ Omborda faqat ${result.available} dona qoldi`
            : '⚠️ Mahsulot topilmadi';
      await ctx.answerCbQuery(message, { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('✅ Savatchaga qo‘shildi');
    const count = cartService.count(ctx.state.user.id);
    const lines = [
      `✅ <b>${result.product.brand} ${result.product.model}</b> savatchaga qo‘shildi.`,
      result.limited ? `⚠️ Ombordagi maksimal miqdor: ${result.quantity} dona` : null,
      `🛒 Savatchada: <b>${count}</b> ta mahsulot`,
    ].filter(Boolean);

    await editOrSend(ctx, lines.join('\n'), addedToCartKeyboard(productId));
  });

  // Darhol sotib olish
  bot.action(/^product:buy:(\d+)$/, async (ctx) => {
    const productId = Number(ctx.match[1]);
    const result = cartService.addItem(ctx.state.user.id, productId);

    if (!result.ok) {
      await ctx.answerCbQuery('❌ Hozirda mahsulot mavjud emas', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery();
    await startCheckout(ctx);
  });

  // Sevimlilar
  bot.action(/^product:fav:(\d+)$/, async (ctx) => {
    const productId = Number(ctx.match[1]);
    const added = favoriteModel.toggle(ctx.state.user.id, productId);
    const product = productService.getProduct(productId);

    await ctx.answerCbQuery(added ? '❤️ Sevimlilarga qo‘shildi' : '💔 Sevimlilardan olib tashlandi');

    if (product) {
      const keyboard = productKeyboard({
        product,
        inStock: product.stock > 0,
        isFavorite: added,
        backAction: BACK_ACTION,
      });
      await ctx
        .editMessageReplyMarkup(keyboard.reply_markup)
        .catch(() => {});
    }
  });

  bot.action(/^product:compare:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('📊 Solishtirish funksiyasi tez orada qo‘shiladi', { show_alert: true });
  });

  bot.action(/^product:soon:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Tez orada', { show_alert: true });
  });

  bot.action('product:help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      'Yetkazish va kafolat shartlari haqida savollaringizni «📞 Bog‘lanish» bo‘limi orqali yuborishingiz mumkin.',
      { ...HTML, ...Markup.inlineKeyboard([[cb('📞 Bog‘lanish', 'contact:open')]]) },
    );
  });
}

export default registerProduct;
