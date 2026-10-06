/**
 * Buyurtma berish jarayoni (ko'p qadamli "wizard").
 *
 * Qadamlar: ism → telefon → yetkazish usuli → manzil (kuryer bo'lsa) → to'lov usuli →
 * izoh (ixtiyoriy) → tasdiqlash → buyurtma yaratish.
 *
 * Muhim: foydalanuvchi buyurtmani tasdiqlashdan oldin uni TO'LIQ ko'radi.
 */
import { Markup } from 'telegraf';
import {
  afterOrderKeyboard,
  confirmOrderKeyboard,
  deliveryKeyboard,
  paymentKeyboard,
  phoneKeyboard,
  skipCommentKeyboard,
} from '../keyboards/orderKeyboard.js';
import { cancelButton } from '../keyboards/common.js';
import { orderCard, orderReview } from '../texts.js';
import { HTML, editOrSend } from '../ui.js';
import { resetFlow } from '../middlewares/session.js';
import cartService from '../../services/cartService.js';
import orderService from '../../services/orderService.js';
import { notifyNewOrder } from '../notifications.js';
import { mainMenuKeyboard } from '../keyboards/mainKeyboard.js';
import { clean, isValidAddress, isValidName, normalizePhone } from '../../utils/validate.js';
import { formatPhone } from '../../utils/format.js';
import { DELIVERY_METHOD, PAYMENT_META } from '../../config/constants.js';

const CANCEL = 'checkout:cancel';

/** Yangi buyurtma jarayonini boshlash */
export async function startCheckout(ctx) {
  const userId = ctx.state.user.id;
  const cart = cartService.getCart(userId);

  if (cart.items.length === 0) {
    await editOrSend(ctx, '🛒 Savatcha bo‘sh. Avval telefon tanlang.', {
      ...Markup.inlineKeyboard([[Markup.button.callback('📱 Katalog', 'catalog:open')]]),
    });
    return;
  }

  const validation = cartService.validateForCheckout(userId);
  if (!validation.ok) {
    const text = validation.issues
      .filter((issue) => issue.reason !== 'empty')
      .map((issue) =>
        issue.reason === 'inactive'
          ? `⚠️ ${issue.name} sotuvdan olingan — savatchadan olib tashlang.`
          : `⚠️ ${issue.name}: omborda faqat ${issue.available} dona qoldi.`,
      )
      .join('\n');
    await editOrSend(ctx, `${text}\n\nSavatchani yangilang 👇`, {
      ...Markup.inlineKeyboard([[Markup.button.callback('🛒 Savatcha', 'cart:open')]]),
    });
    return;
  }

  ctx.session.flow = 'checkout';
  ctx.session.data = {
    step: 'name',
    customerName: null,
    customerPhone: null,
    deliveryMethod: null,
    address: null,
    paymentMethod: null,
    comment: null,
  };

  await askName(ctx);
}

// ---------------------------------------------------------------------------
//  Qadamlar
// ---------------------------------------------------------------------------
async function askName(ctx) {
  ctx.session.data.step = 'name';
  const user = ctx.state.user;
  const suggestion = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();

  if (suggestion && isValidName(suggestion)) {
    ctx.session.data.customerName = suggestion;
    await editOrSend(ctx, `👤 <b>Ism-familiya</b>\n\n<b>${suggestion}</b> — to‘g‘rimi?`, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ To‘g‘ri', 'checkout:name_ok')],
        [Markup.button.callback('✏️ Boshqa ism kiritaman', 'checkout:name_edit')],
        [cancelButton()],
      ]),
    });
    return;
  }

  await editOrSend(ctx, '👤 <b>Ism-familiyangizni kiriting</b>\n\n<i>Masalan: Ali Valiyev</i>', {
    ...Markup.inlineKeyboard([[cancelButton()]]),
  });
}

async function askPhone(ctx) {
  ctx.session.data.step = 'phone';
  await ctx.reply(
    ['📞 <b>Telefon raqamingizni ulashing</b>', '', 'Pastdagi tugmani bosing yoki raqamni qo‘lda kiriting:'].join(
      '\n',
    ),
    { ...HTML, ...phoneKeyboard() },
  );
}

async function askDelivery(ctx) {
  ctx.session.data.step = 'delivery';
  await editOrSend(ctx, '🚚 <b>Yetkazib berish usuli</b>', { ...deliveryKeyboard() });
}

async function askAddress(ctx) {
  ctx.session.data.step = 'address';
  await editOrSend(
    ctx,
    ['📍 <b>Yetkazib berish manzili</b>', '', 'Shahar, tuman, ko‘cha, uy va xonadon raqamini yozing.'].join('\n'),
    { ...Markup.inlineKeyboard([[cancelButton()]]) },
  );
}

async function askPayment(ctx) {
  ctx.session.data.step = 'payment';
  await editOrSend(
    ctx,
    ['💳 <b>To‘lov usuli</b>', '', 'Onlayn to‘lovlar (Click, Payme, Uzum) tez orada qo‘shiladi.'].join('\n'),
    { ...paymentKeyboard() },
  );
}

async function askComment(ctx) {
  ctx.session.data.step = 'comment';
  await editOrSend(
    ctx,
    ['📝 <b>Qo‘shimcha izoh</b>', '', 'Masalan: kuryer tushdan keyin kelsin.'].join('\n'),
    { ...skipCommentKeyboard() },
  );
}

async function askConfirm(ctx) {
  ctx.session.data.step = 'confirm';
  const { items, totals } = cartService.getCart(ctx.state.user.id, {
    deliveryMethod: ctx.session.data.deliveryMethod ?? DELIVERY_METHOD.DELIVERY,
  });

  const userId = ctx.state.user.id;
  ctx.session.data.items = items;
  ctx.session.data.totals = totals;

  // Xotira uchun faqat kerakli maydonlar
  const review = orderReview(ctx.session.data, { items, totals });
  void userId;

  await editOrSend(ctx, review, { ...confirmOrderKeyboard() });
}

/** Telefon raqamni saqlab, keyingi qadamga o'tish */
async function acceptPhone(ctx, rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    await ctx.reply('⚠️ Raqam noto‘g‘ri. Namuna: <code>+998 90 123 45 67</code>', HTML);
    return false;
  }

  ctx.session.data.customerPhone = phone;
  await ctx.reply(`✅ Raqam qabul qilindi: <b>${formatPhone(phone)}</b>`, {
    ...HTML,
    ...Markup.removeKeyboard(),
  });

  await askDelivery(ctx);
  return true;
}

// ---------------------------------------------------------------------------
//  Matn kiritish qadamlari (handlers/index.js dagi router chaqiradi)
// ---------------------------------------------------------------------------
export async function handleCheckoutText(ctx) {
  const data = ctx.session.data;
  const text = clean(ctx.message.text, 200);

  switch (data.step) {
    case 'name': {
      if (!isValidName(text)) {
        await ctx.reply('⚠️ Ismni to‘g‘ri kiriting (kamida 2 harf, faqat harflar).');
        return true;
      }
      data.customerName = text;
      await askPhone(ctx);
      return true;
    }
    case 'phone':
      // Xato bo'lsa ham `acceptPhone` foydalanuvchiga tushunarli xabar yuboradi —
      // shu update'ni "bajarilgan" deb belgilaymiz, aks holda fallback handler
      // qo'shimcha chalkash xabar yuborib, telefon klaviaturasini buzadi.
      await acceptPhone(ctx, text);
      return true;
    case 'address': {
      if (!isValidAddress(text)) {
        await ctx.reply('⚠️ Manzilni to‘liqroq yozing (kamida 8 belgi).');
        return true;
      }
      data.address = text;
      await askPayment(ctx);
      return true;
    }
    case 'comment': {
      data.comment = text.slice(0, 300);
      await askConfirm(ctx);
      return true;
    }
    default:
      return false;
  }
}

/**
 * Kontakt (telefon raqam) ulashilganda ishlaydi.
 * Telegraf `contact` yangilanishi orqali chaqiriladi (handlers/index.js).
 */
export async function handleCheckoutContact(ctx) {
  if (ctx.session?.flow !== 'checkout' || ctx.session.data?.step !== 'phone') return false;
  const phone = ctx.message.contact?.phone_number;
  if (!phone) return false;
  await acceptPhone(ctx, phone);
  return true;
}

export function registerCheckout(bot) {
  bot.action('checkout:start', async (ctx) => {
    await ctx.answerCbQuery();
    await startCheckout(ctx);
  });

  bot.action('checkout:cancel', async (ctx) => {
    resetFlow(ctx);
    await ctx.answerCbQuery('Bekor qilindi');
    await editOrSend(ctx, '❌ Buyurtma bekor qilindi.', {
      ...Markup.inlineKeyboard([[Markup.button.callback('🛒 Savatcha', 'cart:open')]]),
    });
  });

  bot.action('checkout:name_ok', async (ctx) => {
    await ctx.answerCbQuery();
    await askPhone(ctx);
  });

  bot.action('checkout:name_edit', async (ctx) => {
    ctx.session.data.customerName = null;
    await ctx.answerCbQuery();
    await askName(ctx);
  });

  bot.action('checkout:delivery:delivery', async (ctx) => {
    ctx.session.data.deliveryMethod = DELIVERY_METHOD.DELIVERY;
    await ctx.answerCbQuery();
    await askAddress(ctx);
  });

  bot.action('checkout:delivery:pickup', async (ctx) => {
    ctx.session.data.deliveryMethod = DELIVERY_METHOD.PICKUP;
    ctx.session.data.address = null;
    await ctx.answerCbQuery('🏬 Do‘kondan olib ketish');
    await askPayment(ctx);
  });

  bot.action(/^checkout:payment:(cash|card)$/, async (ctx) => {
    ctx.session.data.paymentMethod = ctx.match[1];
    await ctx.answerCbQuery(PAYMENT_META[ctx.match[1]]?.label ?? '');
    await askComment(ctx);
  });

  bot.action('checkout:skip_comment', async (ctx) => {
    ctx.session.data.comment = null;
    await ctx.answerCbQuery();
    await askConfirm(ctx);
  });

  bot.action('checkout:restart', async (ctx) => {
    await ctx.answerCbQuery();
    await askName(ctx);
  });

  bot.action('checkout:confirm', async (ctx) => {
    const data = ctx.session.data;
    await ctx.answerCbQuery('⏳ Buyurtma yaratilmoqda...');

    const result = orderService.createFromCart({
      userId: ctx.state.user.id,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      address: data.address,
      deliveryMethod: data.deliveryMethod ?? DELIVERY_METHOD.DELIVERY,
      paymentMethod: data.paymentMethod ?? 'cash',
      comment: data.comment,
    });

    if (!result.ok) {
      resetFlow(ctx);
      const message =
        result.reason === 'stock' || result.reason === 'inactive'
          ? `⚠️ ${result.message ?? 'Mahsulot omborda qolmadi'}`
          : result.reason === 'empty'
            ? '🛒 Savatcha bo‘sh.'
            : '⚠️ Buyurtma yaratilmadi. Savatchani tekshirib, qaytadan urinib ko‘ring.';

      await editOrSend(ctx, `${message}\n\nQaytadan urinib ko‘rish uchun savatchaga o‘ting.`, {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🛒 Savatcha', 'cart:open')],
          [Markup.button.callback('📱 Katalog', 'catalog:open')],
        ]),
      });
      return;
    }

    resetFlow(ctx);
    const order = result.order;

    await editOrSend(ctx, ['✅ <b>Buyurtma qabul qilindi!</b>', '', orderCard(order)].join('\n'), {
      ...afterOrderKeyboard(order.id),
    });

    // Asosiy menyu klaviaturasini qaytarish
    await ctx.reply('Kerakli bo‘limni tanlang 👇', { ...mainMenuKeyboard() });

    // Adminlarga xabar
    await notifyNewOrder(ctx.telegram, order);
  });
}

export default registerCheckout;
