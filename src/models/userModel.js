/**
 * Foydalanuvchilar modeli.
 */
import { getDb } from '../database/db.js';
import { insertRow, updateRow, bool } from './helpers.js';
import { escapeLike } from '../utils/validate.js';

/** Telegram profilini bazaga yozadi (yoki yangilaydi) va userni qaytaradi */
export function upsertFromTelegram(from) {
  if (!from?.id) throw new Error('upsertFromTelegram: Telegram `from` obyekti kerak');
  const db = getDb();
  db.prepare(
    `INSERT INTO users (telegram_id, username, first_name, last_name, language_code, last_seen_at)
     VALUES (@telegram_id, @username, @first_name, @last_name, @language_code, datetime('now'))
     ON CONFLICT (telegram_id) DO UPDATE SET
       username      = excluded.username,
       first_name    = excluded.first_name,
       last_name     = excluded.last_name,
       language_code = excluded.language_code,
       last_seen_at  = datetime('now'),
       updated_at    = datetime('now')`,
  ).run({
    telegram_id: from.id,
    username: from.username ?? null,
    first_name: from.first_name ?? null,
    last_name: from.last_name ?? null,
    language_code: from.language_code ?? 'uz',
  });
  return findByTelegramId(from.id);
}

export function findByTelegramId(telegramId) {
  return getDb().prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) ?? null;
}

export function findById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
}

export function update(id, data) {
  updateRow('users', id, {
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.firstName !== undefined ? { first_name: data.firstName } : {}),
    ...(data.lastName !== undefined ? { last_name: data.lastName } : {}),
    ...(data.username !== undefined ? { username: data.username } : {}),
    ...(data.isBlocked !== undefined ? { is_blocked: bool(data.isBlocked) } : {}),
  });
  return findById(id);
}

export function setBlocked(id, blocked) {
  return updateRow('users', id, { is_blocked: bool(blocked) });
}

/** Buyurtma yakunlanganda statistikani oshiradi */
export function addOrderTotals(userId, amount) {
  return getDb()
    .prepare(
      `UPDATE users SET orders_count = orders_count + 1,
                        total_spent  = total_spent + @amount,
                        updated_at   = datetime('now')
       WHERE id = @userId`,
    )
    .run({ userId, amount }).changes;
}

export function list({ query = '', page = 1, perPage = 20, onlyWithOrders = false } = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (query) {
    where.push(
      "(LOWER(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') || ' ' || COALESCE(username,'') || ' ' || COALESCE(phone,'')) LIKE LOWER(@q) ESCAPE '\\' OR CAST(telegram_id AS TEXT) = @exact)",
    );
    params.q = `%${escapeLike(query)}%`;
    params.exact = query;
  }
  if (onlyWithOrders) where.push('orders_count > 0');
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const items = db
    .prepare(`SELECT * FROM users ${clause} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: perPage, offset: (page - 1) * perPage });
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM users ${clause}`).get(params);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    hasPrev: page > 1,
    hasNext: page * perPage < total,
  };
}

export function countAll() {
  return getDb().prepare('SELECT COUNT(*) AS total FROM users').get()?.total ?? 0;
}

export function countNewToday() {
  return (
    getDb().prepare("SELECT COUNT(*) AS total FROM users WHERE date(created_at) = date('now')").get()?.total ?? 0
  );
}

/** Barcha foydalanuvchilar (marketing/reklama uchun; feature-flag ostida ishlatiladi) */
export function allTelegramIds({ onlyActive = true } = {}) {
  return getDb()
    .prepare(`SELECT telegram_id FROM users ${onlyActive ? 'WHERE is_blocked = 0' : ''}`)
    .all()
    .map((row) => row.telegram_id);
}

export default {
  upsertFromTelegram,
  findByTelegramId,
  findById,
  update,
  setBlocked,
  addOrderTotals,
  list,
  countAll,
  countNewToday,
  allTelegramIds,
  create: (data) => {
    const { id } = insertRow('users', {
      telegram_id: data.telegramId,
      username: data.username ?? null,
      first_name: data.firstName ?? null,
      last_name: data.lastName ?? null,
      phone: data.phone ?? null,
    });
    return findById(id);
  },
};
