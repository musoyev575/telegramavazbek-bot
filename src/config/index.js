/**
 * Muhit o'zgaruvchilarini yuklash va tekshirish.
 * Maxfiy ma'lumotlar (bot tokeni, parollar) FAQAT .env orqali keladi — kodda saqlanmaydi.
 */
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const toBool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolvePath = (value, fallback) => {
  const target = value && value.trim() ? value.trim() : fallback;
  if (target === ':memory:') return ':memory:'; // testlar uchun xotiradagi baza
  return path.isAbsolute(target) ? target : path.join(rootDir, target);
};

export const paths = Object.freeze({
  root: rootDir,
  src: path.join(rootDir, 'src'),
  storage: path.join(rootDir, 'storage'),
  uploads: path.join(rootDir, 'storage', 'uploads'),
  logs: path.join(rootDir, 'logs'),
  publicDir: path.join(rootDir, 'src', 'admin', 'public'),
  database: resolvePath(process.env.DB_PATH, 'storage/db/shop.sqlite'),
});

export const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  currency: process.env.CURRENCY || "so'm",
  logLevel: process.env.LOG_LEVEL || 'info',
  botToken: (process.env.BOT_TOKEN || '').trim(),
  databasePath: paths.database,
  paths,

  admin: Object.freeze({
    host: process.env.ADMIN_HOST || '127.0.0.1',
    port: toInt(process.env.ADMIN_PORT, 3000),
    sessionHours: toInt(process.env.ADMIN_SESSION_HOURS, 12),
    maxLoginAttempts: toInt(process.env.ADMIN_LOGIN_ATTEMPTS, 5),
    /** Telegram xabarlaridagi havolalar uchun ommaviy manzil (server deploy qilinganda o'zgartiriladi) */
    publicUrl:
      process.env.ADMIN_PUBLIC_URL ||
      `http://${process.env.ADMIN_HOST || '127.0.0.1'}:${toInt(process.env.ADMIN_PORT, 3000)}`,
  }),

  seed: Object.freeze({
    adminUsername: process.env.SEED_ADMIN_USERNAME || 'admin',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin12345!',
    adminTelegramId: process.env.SEED_ADMIN_TELEGRAM_ID
      ? toInt(process.env.SEED_ADMIN_TELEGRAM_ID, null)
      : null,
  }),

  /**
   * Kelajakdagi funksiyalar uchun feature-flag'lar.
   * Arxitektura tayyor: yoqish uchun shu yerda `true` qilish yoki ENV orqali boshqarish kifoya.
   */
  features: Object.freeze({
    onlinePayments: toBool(process.env.FEATURE_ONLINE_PAYMENTS, false),
    promocodes: toBool(process.env.FEATURE_PROMOCODES, false),
    bonuses: toBool(process.env.FEATURE_BONUSES, false),
    cashback: toBool(process.env.FEATURE_CASHBACK, false),
    compare: toBool(process.env.FEATURE_COMPARE, false),
    reviews: toBool(process.env.FEATURE_REVIEWS, false),
    courier: toBool(process.env.FEATURE_COURIER, false),
    smsNotifications: toBool(process.env.FEATURE_SMS, false),
    marketing: toBool(process.env.FEATURE_MARKETING, false),
    crm: toBool(process.env.FEATURE_CRM, false),
  }),
});

/** Bot ishga tushishi oldidan token mavjudligini tekshiradi. */
export function assertBotToken() {
  if (!config.botToken) {
    throw new Error(
      "BOT_TOKEN topilmadi. `.env` faylida BOT_TOKEN=... qiymatini kiriting (.env.example dan nusxa oling).",
    );
  }
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(config.botToken)) {
    throw new Error("BOT_TOKEN formati noto'g'ri ko'rinadi (@BotFather bergan tokenni tekshiring).");
  }
  return config.botToken;
}

export default config;
