/**
 * Sevimlilar (wishlist) modeli.
 */
import { getDb } from '../database/db.js';
import { attachImages } from './productModel.js';

/** Sevimlilarga qo'shadi yoki olib tashlaydi. Qaytadi: true = qo'shildi */
export function toggle(userId, productId) {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?')
    .get(userId, productId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
    return false;
  }
  db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)').run(userId, productId);
  return true;
}

export function isFavorite(userId, productId) {
  return Boolean(
    getDb().prepare('SELECT 1 AS ok FROM favorites WHERE user_id = ? AND product_id = ?').get(userId, productId),
  );
}

export function list(userId) {
  const rows = getDb()
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE f.user_id = ? AND p.is_active = 1
       ORDER BY f.created_at DESC`,
    )
    .all(userId);
  return attachImages(rows);
}

export function count(userId) {
  return getDb().prepare('SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?').get(userId)?.total ?? 0;
}

export function clear(userId) {
  return getDb().prepare('DELETE FROM favorites WHERE user_id = ?').run(userId).changes;
}

export default { toggle, isFavorite, list, count, clear };
