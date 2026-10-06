/**
 * Klaviaturalar uchun umumiy yordamchilar. Barcha `callback_data` qiymatlari
 * "modul:amal:argument" ko'rinishida — handlerlar regex orqali ajratib oladi.
 */
import { Markup } from 'telegraf';
import { ORDER_STATUS, ORDER_STATUS_LABEL } from '../../config/constants.js';

export const cb = Markup.button.callback;

/** Asosiy menyuga qaytish tugmasi */
export function menuButton(label = '🏠 Asosiy menyu') {
  return cb(label, 'nav:menu');
}

/** Orqaga tugmasi (`action` — qaysi ekranga qaytish) */
export function backButton(action = 'nav:menu', label = '🔙 Orqaga') {
  return cb(label, action);
}

/** Bekor qilish (oqimlarni to'xtatish) */
export function cancelButton(label = '❌ Bekor qilish') {
  return cb(label, 'nav:cancel');
}

/** Sahifalash qatori: ⬅️ | 2/5 | ➡️ */
export function paginationRow({ page, totalPages }, prefix) {
  const middle = totalPages > 1 ? cb(`${page}/${totalPages}`, 'nav:noop') : cb('1/1', 'nav:noop');
  return [
    page > 1 ? cb('⬅️', `${prefix}:${page - 1}`) : cb('·', 'nav:noop'),
    middle,
    page < totalPages ? cb('➡️', `${prefix}:${page + 1}`) : cb('·', 'nav:noop'),
  ];
}

/** Buyurtma statuslarini tanlash tugmalari (faqat ruxsat etilgan o'tishlar) */
export function statusButtons(order, allowed, prefix = 'admin:st') {
  return allowed.map((status) => cb(ORDER_STATUS_LABEL[status] ?? status, `${prefix}:${order.id}:${status}`));
}

export { ORDER_STATUS };

export default { cb, menuButton, backButton, cancelButton, paginationRow, statusButtons };
