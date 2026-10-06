/**
 * 24/7 ishonchlilik: zaxira nusxa (backup) va log rotatsiyasi.
 *
 * Bular "yo'q bo'lsa ham bo'ladi" degan funksiyalar emas — kunlik operatsiya. Shuning
 * uchun nusxa haqiqatan yaratilishi, integrity_check o'tishi va eski fayllarning
 * o'chirilishi tekshiriladi.
 *
 * DIQQAT: testlar BACKUP_DIR orqali vaqtinchalik papkaga yozadi — loyihaning
 * haqiqiy storage/backups papkasi ifloslanmaydi.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { freshDatabase, teardownDatabase } from './helpers/db.js';
import { backupFileName, pruneBackups, runBackup, verifyBackup } from '../scripts/backup.js';
import { pruneOldLogs } from '../src/utils/logger.js';

let db;
let tmp;
let previousBackupDir;

before(() => {
  db = freshDatabase();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'telefon-backup-'));
  previousBackupDir = process.env.BACKUP_DIR;
  process.env.BACKUP_DIR = tmp;
});

after(() => {
  if (previousBackupDir === undefined) delete process.env.BACKUP_DIR;
  else process.env.BACKUP_DIR = previousBackupDir;
  teardownDatabase();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('backup: nusxa yaratiladi, tekshiriladi va mahsulotlar saqlanadi', async () => {
  const result = await runBackup({ db, keep: 2 });

  assert.ok(fs.existsSync(result.file), 'backup fayli yaratildi');
  assert.ok(result.size > 0, 'fayl bo‘sh emas');
  assert.ok(result.products > 0, 'nusxada mahsulotlar bor');

  const verified = verifyBackup(result.file);
  assert.equal(verified.ok, true, 'integrity_check o‘tadi');
  assert.equal(verified.products, result.products);

  // Nusxa o'z-o'zicha yetarli bo'lishi kerak: faqat bitta faylni ko'chirish kifoya
  assert.ok(!fs.existsSync(`${result.file}-wal`), 'nusxa yonida -wal qolmasligi kerak');
  assert.ok(!fs.existsSync(`${result.file}-shm`), 'nusxa yonida -shm qolmasligi kerak');

  fs.rmSync(result.file, { force: true });
});

test('backup: fayl nomi sana va vaqtni o‘z ichiga oladi', () => {
  const name = backupFileName(new Date(2026, 9, 5, 3, 15));
  assert.equal(name, 'shop-2026-10-05_0315.sqlite');
});

test('backup: eski nusxalar o‘chiriladi, oxirgi N tasi qoladi', () => {
  for (let index = 0; index < 5; index += 1) {
    const file = path.join(tmp, `shop-2026-10-0${index + 1}_0315.sqlite`);
    fs.writeFileSync(file, 'x');
    fs.utimesSync(file, new Date(2026, 9, index + 1), new Date(2026, 9, index + 1));
  }

  const removed = pruneBackups(tmp, 2);
  const left = fs.readdirSync(tmp).filter((name) => name.endsWith('.sqlite'));

  assert.equal(removed, 3);
  assert.equal(left.length, 2);
  assert.ok(left.includes('shop-2026-10-04_0315.sqlite'), 'eng yangi nusxa qoladi');
  assert.ok(left.includes('shop-2026-10-05_0315.sqlite'));
});

test('loglar: saqlash muddatidan eski kunlik fayllar o‘chiriladi', () => {
  // Chegara: 2026-10-05 minus 14 kun = 2026-09-21
  const now = Date.parse('2026-10-05T12:00:00Z');
  for (const day of ['2026-09-01', '2026-09-10', '2026-09-25', '2026-10-04', '2026-10-05']) {
    fs.writeFileSync(path.join(tmp, `app-${day}.log`), 'log');
  }
  fs.writeFileSync(path.join(tmp, 'boshqa.log'), 'tegilmaydi');

  const removed = pruneOldLogs(tmp, 14, now);
  const left = fs.readdirSync(tmp).filter((name) => name.startsWith('app-'));

  assert.equal(removed, 2, 'faqat 14 kundan eski kunlik loglar o‘chadi');
  assert.deepEqual(left.sort(), ['app-2026-09-25.log', 'app-2026-10-04.log', 'app-2026-10-05.log']);
  assert.ok(fs.existsSync(path.join(tmp, 'boshqa.log')), 'boshqa fayllarga tegilmaydi');
});
