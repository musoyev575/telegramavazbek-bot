/**
 * Savatcha modeli. Narxlar har doim `products` jadvalidan jonli olinadi —
 * shu sababli admin narxni o'zgartirsa, savatchada ham yangi narx ko'rinadi.
 */
import { getDb } from '../database/db.js';

const ITEM_SELECT = `
  SELECT ci.id            AS item_id,
         ci.quantity,
         ci.added_price,
         ci.created_at    AS added_at,
         p.id             AS product_id,
         p.brand, p.model, p.color, p.warranty, p.stock,
         p.price, p.old_price, p.ram, p.storage, p.is_active,
         (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1) AS image
  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id`;

export function getOrCreate(userId) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO carts (user_id) VALUES (?)').run(userId);
  return db.prepare('SELECT * FROM carts WHERE user_id = ?').get(userId);
}

export function findByUser(userId) {
  return getDb().prepare('SELECT * FROM carts WHERE user_id = ?').get(userId) ?? null;
}

/** Savatcha elementlari (mahsulot ma'lumotlari bilan) */
export function itemsWithProducts(cartId) {
  return getDb().prepare(`${ITEM_SELECT} WHERE ci.cart_id = ? ORDER BY ci.created_at ASC, ci.id ASC`).all(cartId);
}

export function findItem(cartId, productId) {
  return (
    getDb().prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartId, productId) ?? null
  );
}

/** Miqdorni o'rnatadi (mavjud bo'lsa yangilaydi) */
export function setItemQuantity(cartId, productId, quantity, addedPrice = null) {
  return getDb()
    .prepare(
      `INSERT INTO cart_items (cart_id, product_id, quantity, added_price)
       VALUES (@cartId, @productId, @quantity, @addedPrice)
       ON CONFLICT (cart_id, product_id) DO UPDATE SET
         quantity   = @quantity,
         updated_at = datetime('now')`,
    )
    .run({ cartId, productId, quantity, addedPrice });
}

export function removeItem(cartId, productId) {
  return getDb().prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cartId, productId).changes;
}

export function clear(cartId) {
  return getDb().prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId).changes;
}

/** Savatchadagi umumiy mahsulot soni (badge uchun) */
export function countItems(userId) {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(ci.quantity), 0) AS total
       FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE c.user_id = ?`,
    )
    .get(userId);
  return row?.total ?? 0;
}

export default { getOrCreate, findByUser, itemsWithProducts, findItem, setItemQuantity, removeItem, clear, countItems };
