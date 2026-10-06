/**
 * Admin web panel autentifikatsiyasi.
 *
 * Xavfsizlik choralari:
 *  - Parollar bcrypt (12 rounds) bilan xeshlanadi.
 *  - Sessiya tokeni `crypto.randomBytes(32)` bilan generatsiya qilinadi; bazada faqat SHA-256 xeshi saqlanadi.
 *  - Cookie: httpOnly + sameSite=strict (+ production'da secure).
 *  - Login urinishlari IP bo'yicha cheklanadi (brute-force himoyasi).
 *  - Sessiya muddati `ADMIN_SESSION_HOURS` bilan cheklanadi.
 */
import crypto from 'node:crypto';
import { compare } from 'bcryptjs';
import config from '../config/index.js';
import adminModel from '../models/adminModel.js';
import auditService from '../services/auditService.js';
import logger from '../utils/logger.js';

const COOKIE_NAME = 'ts_admin';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map();

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function parseCookies(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function setCookie(res, token, expiresAt) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (config.isProduction) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res) {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'];
  if (config.isProduction) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

/** Har bir so'rovda cookie'dagi token bo'yicha sessiyani tiklaydi */
export function sessionMiddleware(req, _res, next) {
  req.cookies = parseCookies(req.headers.cookie);
  const token = req.cookies[COOKIE_NAME];
  req.admin = null;

  if (token) {
    const session = adminModel.findSession(sha256(token));
    if (session) {
      req.admin = {
        id: session.admin_id,
        username: session.username,
        fullName: session.full_name,
        role: session.role,
        telegramId: session.telegram_id,
        sessionId: session.id,
        expiresAt: session.expires_at,
      };
    }
  }
  return next();
}

function checkLoginLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) ?? { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + LOGIN_WINDOW_MS;
  }
  return entry;
}

export async function login({ username, password, ip = 'unknown', userAgent = '' }) {
  const entry = checkLoginLimit(ip);
  if (entry.count >= config.admin.maxLoginAttempts) {
    const minutes = Math.ceil((entry.resetAt - Date.now()) / 60000);
    return { ok: false, status: 429, message: `Juda ko‘p urinish. ${minutes} daqiqadan so‘ng qayta urinib ko‘ring.` };
  }

  const admin = username ? adminModel.findByUsername(String(username).trim()) : null;
  const passwordOk = admin ? await compare(String(password ?? ''), admin.password_hash) : false;

  if (!admin || !passwordOk || !admin.is_active) {
    entry.count += 1;
    loginAttempts.set(ip, entry);
    auditService.log({ actor: username ?? 'unknown', action: 'login_failed', entity: 'admin', ip });
    logger.warn(`Muvaffaqiyatsiz admin kirishi: ${username} (${ip})`);
    return { ok: false, status: 401, message: 'Login yoki parol noto‘g‘ri' };
  }

  loginAttempts.delete(ip);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.admin.sessionHours * 60 * 60 * 1000);
  adminModel.createSession({
    adminId: admin.id,
    tokenHash: sha256(token),
    expiresAt: expiresAt.toISOString(),
    ip,
    userAgent: String(userAgent).slice(0, 200),
  });
  adminModel.touchLogin(admin.id, ip);
  adminModel.purgeExpiredSessions();
  auditService.log({ actor: admin.username, action: 'login', entity: 'admin', entityId: admin.id, ip });

  return {
    ok: true,
    token,
    expiresAt,
    admin: { id: admin.id, username: admin.username, fullName: admin.full_name, role: admin.role },
  };
}

export function logout(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    adminModel.deleteSession(sha256(token));
    auditService.log({ actor: req.admin?.username ?? 'unknown', action: 'logout', ip: req.ip });
  }
}

export function applySessionCookie(res, token, expiresAt) {
  setCookie(res, token, expiresAt);
}

export function applyLogoutCookie(res) {
  clearCookie(res);
}

/** Himoyalangan marshrutlar uchun */
export function requireAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Avval tizimga kiring' } });
  }
  return next();
}

/** Faqat ma'lum rollar uchun (masalan, o'chirish amallari) */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ ok: false, error: { code: 'unauthorized', message: 'Avval tizimga kiring' } });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ ok: false, error: { code: 'forbidden', message: 'Bu amal uchun huquqingiz yo‘q' } });
    }
    return next();
  };
}

/**
 * CSRF himoyasi: o'zgartiruvchi so'rovlar maxsus sarlavha talab qiladi va
 * `Origin` (bo'lsa) shu serverga tegishli bo'lishi kerak.
 */
export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  if (req.get('x-requested-with') !== 'fetch') {
    return res.status(403).json({ ok: false, error: { code: 'csrf', message: 'CSRF tekshiruvi muvaffaqiyatsiz' } });
  }

  const origin = req.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== req.get('host')) {
        return res.status(403).json({ ok: false, error: { code: 'csrf', message: 'Origin mos kelmadi' } });
      }
    } catch {
      return res.status(403).json({ ok: false, error: { code: 'csrf', message: 'Origin noto‘g‘ri' } });
    }
  }

  return next();
}

export default {
  sessionMiddleware,
  login,
  logout,
  applySessionCookie,
  applyLogoutCookie,
  requireAdmin,
  requireRole,
  csrfProtection,
  parseCookies,
};
