/**
 * Oddiy, bog'liqliksiz logger: konsolga + logs/app-YYYY-MM-DD.log fayliga yozadi.
 * Xatolar har doim to'liq stack bilan log qilinadi (xavfsizlik uchun foydalanuvchiga ko'rsatilmaydi).
 */
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const activeLevel = LEVELS[config.logLevel] ?? LEVELS.info;

fs.mkdirSync(config.paths.logs, { recursive: true });

/**
 * 24/7 ishlashda eng ko'p uchraydigan muammo — diskning loglar bilan to'lib ketishi.
 * Har kuni yangi `app-YYYY-MM-DD.log` yaratiladi; shuning uchun eski fayllarni
 * saqlash muddati (kun) bo'yicha o'chirib turamiz. Xato bo'lsa bot ishlashda davom etadi.
 */
export function pruneOldLogs(dir = config.paths.logs, days = 14, now = Date.now()) {
  const limit = now - days * 24 * 60 * 60 * 1000;
  let removed = 0;
  try {
    for (const name of fs.readdirSync(dir)) {
      const match = /^app-(\d{4}-\d{2}-\d{2})\.log$/.exec(name);
      if (!match) continue;
      const stamp = Date.parse(`${match[1]}T00:00:00Z`);
      if (!Number.isFinite(stamp) || stamp >= limit) continue;
      fs.unlinkSync(path.join(dir, name));
      removed += 1;
    }
  } catch {
    return 0;
  }
  return removed;
}

const LOG_RETENTION_DAYS = Number.parseInt(process.env.LOG_RETENTION_DAYS ?? '14', 10) || 14;
const pruned = pruneOldLogs(undefined, LOG_RETENTION_DAYS);
if (pruned > 0) console.log(`[logger] Eski log fayllari o'chirildi: ${pruned} ta (${LOG_RETENTION_DAYS} kundan eski)`);

const SECRET_PATTERN = /(\d{6,}:[A-Za-z0-9_-]{30,})/g; // bot tokenini loglarda yashirish

const redact = (value) => String(value).replace(SECRET_PATTERN, '***BOT_TOKEN***');

const dayFile = () => {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(config.paths.logs, `app-${day}.log`);
};

const serializeMeta = (meta) => {
  if (meta === undefined || meta === null) return '';
  if (meta instanceof Error) return ` ${redact(meta.stack || meta.message)}`;
  try {
    return ` ${redact(JSON.stringify(meta))}`;
  } catch {
    return ` ${redact(String(meta))}`;
  }
};

function write(level, message, meta) {
  if (LEVELS[level] < activeLevel) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${redact(message)}${serializeMeta(meta)}`;
  const printer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  printer(line);
  try {
    fs.appendFileSync(dayFile(), `${line}\n`);
  } catch {
    /* log yozilmasa ham bot ishlashda davom etadi */
  }
}

export const logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  /** Kontekstga bog'langan logger (masalan, buyurtma raqami) */
  with: (scope) => ({
    debug: (m, meta) => write('debug', `[${scope}] ${m}`, meta),
    info: (m, meta) => write('info', `[${scope}] ${m}`, meta),
    warn: (m, meta) => write('warn', `[${scope}] ${m}`, meta),
    error: (m, meta) => write('error', `[${scope}] ${m}`, meta),
  }),
};

export default logger;
