/**
 * Admin web panel serveri (Express).
 *
 * Tuzilma:
 *   /api/admin/*  — JSON API (autentifikatsiya + CSRF bilan himoyalangan)
 *   /uploads/*    — yuklangan mahsulot rasmlari (faqat statik fayllar)
 *   /*            — SPA (login sahifasi va panel)
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { getDb } from '../database/db.js';
import { botStatus } from '../bot/status.js';
import { csrfProtection, sessionMiddleware } from './auth.js';
import apiRoutes from './routes/index.js';

const log = logger.with('admin');

export function createAdminServer() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // --- Xavfsizlik sarlavhalari ---
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self'",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; '),
    );
    if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  });

  // --- Sessiya (cookie -> req.admin) ---
  app.use(sessionMiddleware);

  /**
   * --- Monitoring (autentifikatsiyasiz, faqat holat) ---
   * Serverda uptime-monitoring ishlatish uchun: `curl -f http://127.0.0.1:3000/health`.
   * Maxfiy ma'lumot qaytarilmaydi — faqat "tirikmi" degan savolga javob.
   * `bot.running === false` bo'lsa bot to'xtagan (jarayon ishlab turgan bo'lishi mumkin).
   */
  app.get('/health', (_req, res) => {
    let databaseOk = false;
    try {
      getDb().prepare('SELECT 1 AS ok').get();
      databaseOk = true;
    } catch (error) {
      log.error('Health: bazaga ulanishda xatolik', error);
    }

    const status = botStatus();
    res.status(databaseOk ? 200 : 503).json({
      ok: databaseOk,
      env: config.env,
      uptimeSeconds: Math.floor(process.uptime()),
      checkedAt: new Date().toISOString(),
      database: { ok: databaseOk },
      bot: {
        running: status.running,
        username: status.bot?.username ?? null,
        startedAt: status.startedAt,
        stoppedAt: status.stoppedAt,
        lastUpdateAt: status.lastUpdateAt,
        uptimeSeconds: status.uptimeSeconds,
        lastError: status.lastError,
      },
    });
  });

  // --- API ---
  app.use('/api/admin', csrfProtection, apiRoutes);

  // --- Yuklangan rasmlar ---
  app.use(
    '/uploads',
    express.static(config.paths.uploads, {
      maxAge: '7d',
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  // --- SPA sahifalari ---
  app.get('/login', (_req, res) => res.sendFile(path.join(config.paths.publicDir, 'login.html')));
  app.use(express.static(config.paths.publicDir, { index: 'index.html', extensions: ['html'] }));

  // --- 404 va xatoliklar ---
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Endpoint topilmadi' } });
      return;
    }
    res.status(404).sendFile(path.join(config.paths.publicDir, 'index.html'));
  });

  app.use((error, req, res, _next) => {
    log.error(`API xatoligi ${req.method} ${req.originalUrl}`, error);
    const status = error.statusCode ?? 500;
    res.status(status).json({
      ok: false,
      error: {
        code: error.code ?? 'server_error',
        message: status === 500 ? 'Serverda xatolik yuz berdi' : error.message,
        details: config.isProduction ? undefined : error.details,
      },
    });
  });

  fs.mkdirSync(config.paths.uploads, { recursive: true });
  log.info('Admin panel serveri tayyor');

  return app;
}

export default createAdminServer;
