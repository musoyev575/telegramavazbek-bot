/**
 * Migratsiyalar: sxemani bosqichma-bosqich qo'llash.
 * Har bir migratsiya `schema_migrations` jadvalida qayd etiladi va faqat bir marta bajariladi.
 * Yangi o'zgarish qo'shish uchun MIGRATIONS ro'yxatiga yangi element qo'shing — mavjud
 * bazalar ham, yangi bazalar ham to'g'ri yangilanadi.
 */
import fs from 'node:fs';
import config from '../config/index.js';
import { getDb } from './db.js';
import logger from '../utils/logger.js';

const schemaSql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

const MIGRATIONS = [
  {
    version: 1,
    name: 'boshlangich-sxema',
    up: (db) => db.exec(schemaSql),
  },
  {
    version: 2,
    name: 'demo-rasm-url-tuzatish',
    // Eski demo rasmlar `placehold.co/600x800.png/...` ko'rinishida edi — bu 404
    // qaytaradi va Telegram mahsulot rasmini yuklay olmaydi (sendPhoto xatosi).
    // To'g'ri format: `placehold.co/600x800/1e293b/e2e8f0.png?text=...`
    up: (db) => {
      const BROKEN = /^https:\/\/placehold\.co\/(\d+x\d+)\.png\/([^?]+)(\?.*)?$/;
      const rows = db.prepare("SELECT id, url FROM product_images WHERE url LIKE '%placehold.co%'").all();
      const update = db.prepare('UPDATE product_images SET url = ? WHERE id = ?');
      for (const row of rows) {
        const fixed = row.url.replace(BROKEN, 'https://placehold.co/$1/$2.png$3');
        if (fixed !== row.url) update.run(fixed, row.id);
      }
    },
  },
];

export function runMigrations(db = getDb()) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version));
  let count = 0;

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name,
      );
    });
    apply();
    logger.info(`Migratsiya qo'llandi: v${migration.version} (${migration.name})`);
    count += 1;
  }

  return count;
}

/** Kerakli papkalarni tayyorlash + migratsiyalarni qo'llash */
export function initDatabase({ db = getDb(), storage = true } = {}) {
  if (storage) {
    fs.mkdirSync(config.paths.storage, { recursive: true });
    fs.mkdirSync(config.paths.uploads, { recursive: true });
    fs.mkdirSync(config.paths.logs, { recursive: true });
  }
  runMigrations(db);
  return db;
}

export default { runMigrations, initDatabase };
