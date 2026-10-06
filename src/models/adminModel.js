/**
 * Administratorlar va admin sessiyalari modeli.
 * XAVFSIZLIK: sessiya tokeni bazada faqat SHA-256 xesh ko'rinishida saqlanadi —
 * bazaga kirish huquqi olgan odam ham faol sessiyalardan foydalana olmaydi.
 */
import { getDb } from '../database/db.js';
import { insertRow, updateRow, bool } from './helpers.js';

export function findByUsername(username) {
  return getDb().prepare('SELECT * FROM admins WHERE LOWER(username) = LOWER(?)').get(username) ?? null;
}

export function findById(id) {
  return getDb().prepare('SELECT * FROM admins WHERE id = ?').get(id) ?? null;
}

export function findByTelegramId(telegramId) {
  return getDb().prepare('SELECT * FROM admins WHERE telegram_id = ? AND is_active = 1').get(telegramId) ?? null;
}

export function list({ includeInactive = true } = {}) {
  return getDb()
    .prepare(`SELECT * FROM admins ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY created_at ASC`)
    .all();
}

/** Buyurtma xabarlarini oladigan adminlar */
export function withTelegram() {
  return getDb().prepare('SELECT * FROM admins WHERE is_active = 1 AND telegram_id IS NOT NULL').all();
}

export function create({ username, passwordHash, fullName = null, role = 'admin', telegramId = null }) {
  const { id } = insertRow('admins', {
    username,
    password_hash: passwordHash,
    full_name: fullName,
    role,
    telegram_id: telegramId,
  });
  return findById(id);
}

export function update(id, data) {
  updateRow('admins', id, {
    ...(data.fullName !== undefined ? { full_name: data.fullName } : {}),
    ...(data.role !== undefined ? { role: data.role } : {}),
    ...(data.telegramId !== undefined ? { telegram_id: data.telegramId } : {}),
    ...(data.isActive !== undefined ? { is_active: bool(data.isActive) } : {}),
  });
  return findById(id);
}

export function setPassword(id, passwordHash) {
  updateRow('admins', id, { password_hash: passwordHash });
  return findById(id);
}

export function touchLogin(id, ip = null) {
  updateRow('admins', id, { last_login_at: null, last_login_ip: ip });
  getDb().prepare("UPDATE admins SET last_login_at = datetime('now') WHERE id = ?").run(id);
}

export function countAll() {
  return getDb().prepare('SELECT COUNT(*) AS total FROM admins').get()?.total ?? 0;
}

// ---------------------------------------------------------------------------
//  Sessiyalar
// ---------------------------------------------------------------------------
export function createSession({ adminId, tokenHash, expiresAt, ip = null, userAgent = null }) {
  const { id } = insertRow('admin_sessions', {
    admin_id: adminId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip,
    user_agent: userAgent,
  });
  return id;
}

/** Faqat muddati o'tmagan va admini faol bo'lgan sessiyani qaytaradi */
export function findSession(tokenHash) {
  return (
    getDb()
      .prepare(
        `SELECT s.*, a.username, a.full_name, a.role, a.is_active, a.telegram_id
         FROM admin_sessions s
         JOIN admins a ON a.id = s.admin_id
         WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND a.is_active = 1`,
      )
      .get(tokenHash) ?? null
  );
}

export function deleteSession(tokenHash) {
  return getDb().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash).changes;
}

export function deleteSessionsForAdmin(adminId) {
  return getDb().prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(adminId).changes;
}

export function purgeExpiredSessions() {
  return getDb().prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')").run().changes;
}

export default {
  findByUsername,
  findById,
  findByTelegramId,
  list,
  withTelegram,
  create,
  update,
  setPassword,
  touchLogin,
  countAll,
  createSession,
  findSession,
  deleteSession,
  deleteSessionsForAdmin,
  purgeExpiredSessions,
};
