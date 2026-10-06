/**
 * «📦 Buyurtmalarim» bo'limi: buyurtmalar ro'yxati, batafsil ko'rish, qayta buyurtma qilish.
 *
 * XAVFSIZLIK: buyurtma ochishdan oldin uning shu foydalanuvchiga tegishli ekani tekshiriladi
 * (boshqa odamning buyurtmasini ID orqali ko'rish mumkin emas).
 */
import { Markup } from 'telegraf';
import { cb } from '../keyboards/common.js';
import { orderCard, orderShortLine } from '../texts.js';
import { editOrSend } from '../ui.js';
import orderService from '../../services/orderService.js';
import cartService from '../../services/cartService.js';
import { MENU, ORDER_STATUS_LABEL } from '../../config/constants.js';

const PER_PAGE = 5;

function ordersKeyboard(orders) {
  const rows = orders.map((order, index) => [
    cb(
      `${index + 1}. ${order.order_number} · ${ORDER_STATUS_LABEL[order.status] ?? order.status}`,
      `orders:open:${order.id}`,
    ),
  ]);
  rows.push([cb('🏠 Asosiy menyu', 'nav:menu')]);
  return Markup.inlineKeyboard(rows);
}

export async function showOrders(ctx, { edit = true, page = 1 } = {}) {
  const userId = ctx.state.user.id;
  const { items, total } = orderService.getUserOrders(userId, { page, perPage: PER_PAGE });

  if (items.length === 0) {
    const text = ['📦 <b>Buyurtmalarim</b>', '', 'Sizda hali buyurtma yo‘q.'].join('\n');
    const keyboard = Markup.inlineKeyboard([
      [cb('📱 Katalog', 'catalog:open')],
      [cb('🏠 Asosiy menyu', 'nav:menu')],
    ]);
    if (edit) await editOrSend(ctx, text, { ...keyboard });
    else await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
    return;
  }

  const text = [
    '📦 <b>Buyurtmalarim</b>',
    '',
    items.map((order) => orderShortLine(order)).join('\n'),
    '',
    `Jami: <b>${total}</b> ta buyurtma`,
    "Batafsil ko'rish uchun buyurtmani tanlang 👇",
  ].join('\n');

  const keyboard = ordersKeyboard(items);
  if (edit) await editOrSend(ctx, text, { ...keyboard });
  else await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });

  void ordersKeyboard;
}

export function registerOrders(bot) {
  const open = async (ctx) => {
    ctx.session.flow = null;
    // `open` ham matn (menyu tugmasi), ham callback orqali chaqiriladi —
    // answerCbQuery faqat callback kontekstida mavjud.
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    await showOrders(ctx, { edit: Boolean(ctx.callbackQuery) });
  };

  bot.hears(MENU.ORDERS, open);
  bot.command('buyurtmalarim', open);
  bot.action('orders:list', open);

  bot.action(/^orders:open:(\d+)$/, async (ctx) => {
    const orderId = Number(ctx.match[1]);
    const order = orderService.getOrder(orderId);

    if (!order || order.user_id !== ctx.state.user.id) {
      await ctx.answerCbQuery('⛔ Buyurtma topilmadi', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery();
    const rows = [
      [cb('🔁 Qayta buyurtma qilish', `orders:reorder:${order.id}`)],
      [cb('📞 Bog‘lanish', 'contact:open')],
      [cb('📦 Barcha buyurtmalar', 'orders:list')],
    ];

    await editOrSend(ctx, orderCard(order), { ...Markup.inlineKeyboard(rows) });
  });

  bot.action(/^orders:reorder:(\d+)$/, async (ctx) => {
    const orderId = Number(ctx.match[1]);
    const order = orderService.getOrder(orderId);

    if (!order || order.user_id !== ctx.state.user.id) {
      await ctx.answerCbQuery('⛔ Buyurtma topilmadi', { show_alert: true });
      return;
    }

    let added = 0;
    const skipped = [];
    for (const item of order.items) {
      if (!item.product_id) {
        skipped.push(`${item.product_name} (sotuvda yo‘q)`);
        continue;
      }
      const result = cartService.addItem(ctx.state.user.id, item.product_id, item.quantity);
      if (result.ok) added += 1;
      else skipped.push(`${item.product_name} (omborda yo‘q)`);
    }

    const lines = [`🛒 Savatchaga qo‘shildi: <b>${added}</b> ta mahsulot`];
    if (skipped.length) lines.push('', `⚠️ Qo‘shilmadi: ${skipped.join(', ')}`);

    await ctx.answerCbQuery(added ? '✅ Savatchaga qo‘shildi' : '⚠️ Mahsulotlar mavjud emas');
    await editOrSend(ctx, lines.join('\n'), {
      ...Markup.inlineKeyboard([
        [cb('🛒 Savatcha', 'cart:open'), cb('✅ Buyurtma berish', 'checkout:start')],
        [cb('🏠 Asosiy menyu', 'nav:menu')],
      ]),
    });
  });
}

export default registerOrders;
