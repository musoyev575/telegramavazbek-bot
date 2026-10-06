/**
 * Savatcha: ko'rish, miqdorni o'zgartirish, o'chirish, tozalash.
 */
import { cartKeyboard } from '../keyboards/cartKeyboard.js';
import { cartText } from '../texts.js';
import { editOrSend } from '../ui.js';
import cartService from '../../services/cartService.js';
import { MENU } from '../../config/constants.js';

/** Savatchani ko'rsatadi */
export async function showCart(ctx, { edit = true } = {}) {
  const cart = cartService.getCart(ctx.state.user.id);
  const text = cartText(cart);
  const keyboard = cartKeyboard(cart.items);

  if (edit) await editOrSend(ctx, text, keyboard);
  else await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });

  return cart;
}

export function registerCart(bot) {
  bot.hears(MENU.CART, async (ctx) => {
    ctx.session.flow = null;
    await showCart(ctx, { edit: false });
  });

  bot.action('cart:open', async (ctx) => {
    ctx.session.flow = null;
    await ctx.answerCbQuery();
    await showCart(ctx);
  });

  bot.action(/^cart:inc:(\d+)$/, async (ctx) => {
    const productId = Number(ctx.match[1]);
    const cart = cartService.getCart(ctx.state.user.id);
    const item = cart.items.find((entry) => entry.product_id === productId);
    const result = cartService.setQuantity(ctx.state.user.id, productId, (item?.quantity ?? 0) + 1);

    if (!result.ok && result.reason === 'not_enough_stock') {
      await ctx.answerCbQuery(`⚠️ Omborda faqat ${result.available} dona qoldi`, { show_alert: true });
      return;
    }

    await ctx.answerCbQuery();
    await showCart(ctx);
  });

  bot.action(/^cart:dec:(\d+)$/, async (ctx) => {
    const productId = Number(ctx.match[1]);
    const cart = cartService.getCart(ctx.state.user.id);
    const item = cart.items.find((entry) => entry.product_id === productId);

    if ((item?.quantity ?? 0) <= 1) {
      cartService.removeItem(ctx.state.user.id, productId);
      await ctx.answerCbQuery('🗑 O‘chirildi');
    } else {
      cartService.setQuantity(ctx.state.user.id, productId, item.quantity - 1);
      await ctx.answerCbQuery();
    }
    await showCart(ctx);
  });

  bot.action(/^cart:remove:(\d+)$/, async (ctx) => {
    cartService.removeItem(ctx.state.user.id, Number(ctx.match[1]));
    await ctx.answerCbQuery('🗑 O‘chirildi');
    await showCart(ctx);
  });

  bot.action('cart:clear', async (ctx) => {
    cartService.clear(ctx.state.user.id);
    await ctx.answerCbQuery('Savatcha tozalandi');
    await showCart(ctx);
  });
}

export default registerCart;
