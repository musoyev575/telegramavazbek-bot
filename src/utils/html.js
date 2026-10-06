/**
 * Telegram uchun matn yordamchilari: HTML escape, qisqartirish, ro'yxat.
 * Bot barcha xabarlarida `parse_mode: 'HTML'` ishlatiladi — foydalanuvchi kiritgan
 * har qanday matn majburiy ravishda escapeHtml'dan o'tadi (HTML injection oldini oladi).
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const b = (value) => `<b>${escapeHtml(value)}</b>`;
export const i = (value) => `<i>${escapeHtml(value)}</i>`;
export const code = (value) => `<code>${escapeHtml(value)}</code>`;

export function truncate(value, length = 120) {
  const text = String(value ?? '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/** ["A", "B"] -> "• A\n• B" */
export function bulletList(items) {
  return items.filter(Boolean).map((item) => `• ${item}`).join('\n');
}

/** "🔋 Batareya: 3200 mAh" qatorini faqat qiymat mavjud bo'lsa qaytaradi */
export function specLine(label, value) {
  return value ? `${label}: ${escapeHtml(value)}` : null;
}

/** Mahsulot tavsifini Telegram uchun xavfsiz qilib kesish */
export function safeDescription(value, length = 400) {
  return escapeHtml(truncate(value, length));
}

export default { escapeHtml, b, i, code, truncate, bulletList, specLine, safeDescription };
