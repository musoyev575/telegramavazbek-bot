/**
 * Buyurtma berish jarayoni klaviaturalari.
 */
import { Markup } from 'telegraf';
import { cb, cancelButton } from './common.js';
import { DELIVERY_METHOD, DELIVERY_LABEL, PAYMENT_METHOD, PAYMENT_META } from '../../config/constants.js';

/** Yetkazish usuli */
export function deliveryKeyboard() {
  return Markup.inlineKeyboard([
    [cb(DELIVERY_LABEL[DELIVERY_METHOD.DELIVERY], `checkout:delivery:${DELIVERY_METHOD.DELIVERY}`)],
    [cb(DELIVERY_LABEL[DELIVERY_METHOD.PICKUP], `checkout:delivery:${DELIVERY_METHOD.PICKUP}`)],
    [cancelButton()],
  ]);
}

/** To'lov usuli (faqat yoqilganlari; onlayn to'lovlar feature-flag ostida) */
export function paymentKeyboard() {
  const rows = Object.entries(PAYMENT_META)
    .filter(([, meta]) => meta.enabled)
    .map(([code, meta]) => [cb(meta.label, `checkout:payment:${code}`)]);
  rows.push([cb('➕ Click / Payme / Uzum (tez orada)', 'nav:noop')]);
  rows.push([cancelButton()]);
  return Markup.inlineKeyboard(rows);
}

/** Telefon raqamini so'rash */
export function phoneKeyboard() {
  return Markup.keyboard([[Markup.button.contactRequest('📱 Raqamimni ulashish')]])
    .resize()
    .oneTime();
}

/** Buyurtmani tasdiqlash */
export function confirmOrderKeyboard() {
  return Markup.inlineKeyboard([
    [cb('✅ Tasdiqlash', 'checkout:confirm')],
    [cb('✏️ Ma’lumotni o‘zgartirish', 'checkout:restart')],
    [cancelButton()],
  ]);
}

/** Izohni o'tkazib yuborish */
export function skipCommentKeyboard() {
  return Markup.inlineKeyboard([[cb('⏭ Izohsiz davom etish', 'checkout:skip_comment')], [cancelButton()]]);
}

/** Buyurtma berilgach */
export function afterOrderKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [cb('📦 Buyurtmalarim', 'orders:list')],
    [cb('📱 Katalogga qaytish', 'catalog:page:1'), cb('🏠 Asosiy menyu', 'nav:menu')],
  ]);
}

export { DELIVERY_METHOD, PAYMENT_METHOD };

export default {
  deliveryKeyboard,
  paymentKeyboard,
  phoneKeyboard,
  confirmOrderKeyboard,
  skipCommentKeyboard,
  afterOrderKeyboard,
};
