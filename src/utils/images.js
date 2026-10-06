/**
 * Mahsulot rasmlari uchun manba aniqlash.
 *
 * XAVFSIZLIK: `/uploads/...` ko'rinishidagi ichki yo'llar FAQAT storage/uploads papkasi
 * ichidan olinadi (path traversal — "../.." kabi hujumlar bloklanadi). Faqat http(s)
 * havolalar va ruxsat etilgan kengaytmali fayllar qabul qilinadi.
 */
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';
import { isAllowedImageUrl } from './validate.js';

/**
 * Telegraf `sendPhoto` uchun manba qaytaradi:
 *  - tashqi rasm  -> URL matni
 *  - ichki fayl   -> { source: '/abs/path.jpg' } (stream)
 *  - mos kelmasa  -> null (matn ko'rinishida yuboriladi)
 */
export function resolveImageSource(url) {
  if (!isAllowedImageUrl(url)) return null;

  if (/^https?:\/\//i.test(url)) return url.trim();

  const fileName = path.basename(url); // traversal'ni yo'q qiladi
  const absolute = path.join(config.paths.uploads, fileName);
  const uploadsRoot = path.resolve(config.paths.uploads);

  if (!path.resolve(absolute).startsWith(uploadsRoot)) return null;
  if (!fs.existsSync(absolute)) return null;
  return { source: absolute };
}

export default { resolveImageSource };
