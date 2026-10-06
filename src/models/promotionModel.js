/**
 * Promokodlar modeli (feature-flag ostida yoqiladi).
 * `apply()` funksiyasi kodni tekshiradi, chegirmani hisoblaydi va ishlatilish sonini oshiradi.
 */
import { getDb } from '../database/db.js';
import { insertRow, updateRow, bool } from './helpers.js';

export function list({ includeInactive = true } = {}) {
  return getDb()
    .prepare(`SELECT * FROM promocodes ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY created_at DESC`)
    .all();
}

export function findByCode(code) {
  return getDb().prepare('SELECT * FROM promocodes WHERE UPPER(code) = UPPER(?)').get(String(code).trim()) ?? null;
}

export function create(data) {
  const { id } = insertRow('promocodes', {
    code: String(data.code).trim().toUpperCase(),
    discount_type: data.discountType ?? 'percent',
    discount_value: data.discountValue,
    min_amount: data.minAmount ?? 0,
    usage_limit: data.usageLimit ?? null,
    starts_at: data.startsAt ?? null,
    expires_at: data.expiresAt ?? null,
    is_active: data.isActive === undefined ? 1 : bool(data.isActive),
  });
  return getDb().prepare('SELECT * FROM promocodes WHERE id = ?').get(id);
}

export function update(id, data) {
  updateRow('promocodes', id, {
    ...(data.discountType !== undefined ? { discount_type: data.discountType } : {}),
    ...(data.discountValue !== undefined ? { discount_value: data.discountValue } : {}),
    ...(data.minAmount !== undefined ? { min_amount: data.minAmount } : {}),
    ...(data.usageLimit !== undefined ? { usage_limit: data.usageLimit } : {}),
    ...(data.expiresAt !== undefined ? { expires_at: data.expiresAt } : {}),
    ...(data.isActive !== undefined ? { is_active: bool(data.isActive) } : {}),
  }, { touch: false });
  return getDb().prepare('SELECT * FROM promocodes WHERE id = ?').get(id);
}

export function remove(id) {
  return getDb().prepare('DELETE FROM promocodes WHERE id = ?').run(id).changes;
}

/**
 * Promokodni buyurtma summasiga qo'llaydi.
 * Qaytadi: { ok, discount, promo?, reason? }
 */
export function apply(code, amount) {
  const promo = findByCode(code);
  if (!promo) return { ok: false, reason: 'Promokod topilmadi' };
  if (!promo.is_active) return { ok: false, reason: 'Promokod faol emas' };
  if (promo.starts_at && new Date(`${promo.starts_at}T00:00:00Z`) > new Date()) {
    return { ok: false, reason: 'Promokod muddati hali boshlanmadi' };
  }
  if (promo.expires_at && new Date(`${promo.expires_at}T23:59:59Z`) < new Date()) {
    return { ok: false, reason: 'Promokod muddati tugagan' };
  }
  if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
    return { ok: false, reason: 'Promokod ishlatilish limiti tugagan' };
  }
  if (amount < promo.min_amount) {
    return { ok: false, reason: `Promokod ${promo.min_amount} so'mdan yuqori buyurtmalar uchun` };
  }

  const discount =
    promo.discount_type === 'percent'
      ? Math.round((amount * promo.discount_value) / 100)
      : Math.min(promo.discount_value, amount);

  return { ok: true, discount, promo };
}

/** Promokoddan foydalanilganini qayd etish */
export function markUsed(code) {
  return getDb().prepare('UPDATE promocodes SET used_count = used_count + 1 WHERE UPPER(code) = UPPER(?)').run(code)
    .changes;
}

export default { list, findByCode, create, update, remove, apply, markUsed };
