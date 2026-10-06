/**
 * SQLite zaxira nusxasi (backup) — 24/7 ishlaydigan baza uchun.
 *
 * `better-sqlite3` ning `db.backup()` metodi ONLINE backup qiladi: WAL rejimida
 * ishlayotgan bazani to'xtatmasdan izchil nusxa oladi. Faylni shunchaki `cp` qilish
 * WAL bilan xavfli (yarim yozilgan holat) — shuning uchun shu skript ishlatiladi.
 *
 * Ishlatish:
 *   npm run backup                 # storage/backups/shop-YYYY-MM-DD_HHmm.sqlite
 *   BACKUP_KEEP=30 npm run backup  # oxirgi 30 nusxani saqlash
 *
 * Cron (har kuni 03:15 da):
 *   15 3 * * * cd /opt/telefon-bot && /usr/bin/npm run backup >> logs/backup.log 2>&1
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import config from '../src/config/index.js';
import logger from '../src/utils/logger.js';

const log = logger.with('backup');

export function backupDir() {
  // BACKUP_DIR — testlar va maxsus o'rnatishlar uchun (masalan, tashqi disk)
  return process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.join(config.paths.storage, 'backups');
}

/** Nusxa fayl nomi: shop-2026-10-05_0315.sqlite */
export function backupFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `shop-${stamp}_${time}.sqlite`;
}

/** Eski nusxalarni o'chirib, oxirgi `keep` tasini qoldiradi. O'chirilganlar soni qaytadi. */
export function pruneBackups(dir = backupDir(), keep = 14) {
  let removed = 0;
  try {
    const files = fs
      .readdirSync(dir)
      .filter((name) => /^shop-.*\.sqlite$/.test(name))
      .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    const keepSet = new Set(files.slice(0, keep).map((file) => file.name));

    for (const file of files) {
      if (keepSet.has(file.name)) continue;
      fs.unlinkSync(path.join(dir, file.name));
      removed += 1;
      // Yon fayllar ham o'chiriladi (aks holda axlat to'planib qoladi)
      for (const sidecar of [`${file.name}-wal`, `${file.name}-shm`]) {
        const target = path.join(dir, sidecar);
        if (fs.existsSync(target)) {
          fs.unlinkSync(target);
          removed += 1;
        }
      }
    }
  } catch {
    return 0;
  }
  return removed;
}

/**
 * Nusxani "o'z-o'zicha yetarli" holatga keltiradi: WAL checkpoint qilinib, journal
 * rejimi DELETE ga o'tadi. Aks holda har bir nusxa yoniga `-wal`/`-shm` fayllari
 * qo'shilib ketadi va faqat asosiy faylni ko'chirish xavfli bo'ladi.
 */
export function normalizeBackup(file) {
  const target = new Database(file, { fileMustExist: true });
  try {
    target.pragma('wal_checkpoint(TRUNCATE)');
    target.pragma('journal_mode = DELETE');
  } finally {
    target.close();
  }
}

/** Nusxani ochib, butunligini (integrity) va jadval borligini tekshiradi */
export function verifyBackup(file) {
  const check = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const integrity = check.prepare('PRAGMA integrity_check').get();
    const value = integrity?.integrity_check ?? Object.values(integrity ?? {})[0];
    if (value !== 'ok') throw new Error(`integrity_check: ${value}`);
    const products = check.prepare('SELECT COUNT(*) AS total FROM products').get().total;
    return { ok: true, products };
  } finally {
    check.close();
  }
}

/**
 * Zaxira nusxa oladi va tekshiradi.
 * @param {object} options
 * @param {number} options.keep - saqlanadigan nusxalar soni
 * @param {object} options.db - better-sqlite3 instansiyasi (test uchun)
 */
export async function runBackup({ keep = 14, db = null } = {}) {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });

  const destination = path.join(dir, backupFileName());

  // Sxema ishlatilishidan oldin bazani tayyorlaymiz (migratsiya + seed)
  const source = db ?? (await import('../src/database/db.js')).getDb();
  await source.backup(destination);

  normalizeBackup(destination);
  const size = fs.statSync(destination).size;
  const verified = verifyBackup(destination);
  const removed = pruneBackups(dir, keep);

  log.info(`Zaxira nusxa tayyor: ${path.basename(destination)} (${(size / 1024).toFixed(1)} KB, ${verified.products} mahsulot)`);
  if (removed) log.info(`Eski nusxalar o'chirildi: ${removed} ta (oxirgi ${keep} ta saqlanadi)`);

  return { file: destination, size, products: verified.products, removed };
}

/** Skript to'g'ridan-to'g'ri chaqirilganda ishlaydi */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const keep = Number.parseInt(process.env.BACKUP_KEEP ?? '14', 10) || 14;
  try {
    const result = await runBackup({ keep });
    console.log(`✅ Backup: ${result.file}`);
  } catch (error) {
    log.error('Zaxira nusxa olishda xatolik', error);
    process.exit(1);
  } finally {
    try {
      const { closeDb } = await import('../src/database/db.js');
      closeDb();
    } catch {
      /* baza allaqachon yopilgan */
    }
  }
}

export default { runBackup, pruneBackups, verifyBackup, normalizeBackup, backupDir, backupFileName };
