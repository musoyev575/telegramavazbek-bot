/**
 * Sozlamalar modeli (kalit-qiymat). Admin panel orqali o'zgartiriladi,
 * bot esa qiymatlarni `get()` orqali o'qiydi.
 */
import { getDb } from '../database/db.js';
import { DEFAULT_SETTINGS } from '../config/constants.js';

export function get(key, fallback = null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (row?.value === undefined || row?.value === null || row?.value === '') {
    return fallback ?? DEFAULT_SETTINGS[key] ?? null;
  }
  return row.value;
}

export function getInt(key, fallback = 0) {
  const raw = get(key, null);
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function set(key, value) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (@key, @value)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run({ key, value: value === null || value === undefined ? null : String(value) });
  return get(key);
}

export function setMany(values = {}) {
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (@key, @value)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  );
  db.transaction(() => {
    for (const [key, value] of Object.entries(values)) {
      upsert.run({ key, value: value === null || value === undefined ? null : String(value) });
    }
  })();
  return all();
}

/** Barcha sozlamalar + standart qiymatlar (admin panel uchun) */
export function all() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function remove(key) {
  return getDb().prepare('DELETE FROM settings WHERE key = ?').run(key).changes;
}

export default { get, getInt, set, setMany, all, remove };
