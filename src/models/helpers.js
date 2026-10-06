/**
 * Modellar uchun umumiy yordamchilar.
 * MUHIM: barcha qiymatlar nomlangan parametrlar (@param) orqali uzatiladi —
 * SQL injection'ga yo'l qo'yilmaydi. Ustun nomlari esa whitelist'dan olinadi.
 */
import { getDb } from '../database/db.js';

/** Berilgan obyektdan faqat ruxsat etilgan kalitlarni ajratib oladi */
export function pick(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

/** camelCase -> snake_case (model maydonlarini DB ustunlariga o'girish uchun) */
export function toSnake(key) {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

/** Yangi qator qo'shadi: insertRow('products', {brand: 'Apple', ...}) */
export function insertRow(table, fields) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) throw new Error(`insertRow: ${table} uchun maydonlar bo'sh`);
  const columns = entries.map(([key]) => key);
  const params = Object.fromEntries(entries);
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((key) => `@${key}`).join(', ')})`;
  const info = getDb().prepare(sql).run(params);
  return { id: Number(info.lastInsertRowid), changes: info.changes };
}

/** Mavjud qatorni yangilaydi (faqat berilgan maydonlar, updated_at avtomatik) */
export function updateRow(table, id, fields, { touch = true } = {}) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return 0;
  const params = { ...Object.fromEntries(entries), id };
  const sets = entries.map(([key]) => `${key} = @${key}`);
  if (touch) sets.push("updated_at = datetime('now')");
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE id = @id`;
  return getDb().prepare(sql).run(params).changes;
}

/** Boolean -> SQLite uchun 0/1 */
export const bool = (value) => (value ? 1 : 0);

export default { pick, toSnake, insertRow, updateRow, bool };
