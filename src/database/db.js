/**
 * Ma'lumotlar bazasi ulanishi (SQLite / better-sqlite3).
 *
 * - Singleton ulanish: butun ilova bitta connection ishlatadi (SQLite uchun optimal).
 * - WAL rejimi: o'qish va yozish bir-birini bloklamaydi (admin panel + bot bir vaqtda ishlaydi).
 * - Testlarda `setDb()` orqali xotiradagi (in-memory) baza ulanadi.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import config from '../config/index.js';

let instance = null;

/** Yangi ulanish ochadi (fayl yoki :memory:) */
export function openDatabase(file = config.databasePath) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  // WAL faqat fayl bazalari uchun mazmunli; :memory: da xato bermaydi.
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  return db;
}

/** Ilova bo'ylab yagona ulanish */
export function getDb() {
  if (!instance) instance = openDatabase();
  return instance;
}

/** Testlar uchun ulanishni almashtirish */
export function setDb(db) {
  instance = db;
  return instance;
}

export function closeDb() {
  if (instance) {
    try {
      instance.close();
    } catch {
      /* allaqachon yopilgan */
    }
    instance = null;
  }
}

/** Tranzaksiyaga o'ralgan funksiya qaytaradi: tx(fn)(args) */
export function tx(fn) {
  return getDb().transaction(fn);
}

/** Berilgan funksiyani darhol tranzaksiya ichida bajaradi */
export function inTransaction(fn) {
  return getDb().transaction(fn)();
}

export default { getDb, setDb, closeDb, openDatabase, tx, inTransaction };
