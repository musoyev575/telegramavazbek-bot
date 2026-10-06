/**
 * Savatcha klaviaturasi: har bir mahsulot uchun ➖ / miqdor / ➕ / 🗑.
 */
import { Markup } from 'telegraf';
import { cb } from './common.js';

export function cartKeyboard(items = []) {
  const rows = items.map((item) => [
    cb('➖', `cart:dec:${item.product_id}`),
    cb(`${item.quantity} dona`, 'nav:noop'),
    cb('➕', `cart:inc:${item.product_id}`),
    cb('🗑', `cart:remove:${item.product_id}`),
  ]);

  if (items.length > 0) {
    rows.push([cb('✅ Buyurtma berish', 'checkout:start')]);
    rows.push([cb('🗑 Savatchani tozalash', 'cart:clear')]);
  }
  rows.push([cb('🏠 Asosiy menyu', 'nav:menu')]);
  return Markup.inlineKeyboard(rows);
}

export default { cartKeyboard };
