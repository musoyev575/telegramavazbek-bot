/**
 * Autentifikatsiya endpointlari: kirish, chiqish, joriy sessiya, parolni almashtirish.
 */
import { Router } from 'express';
import { compare, hashSync } from 'bcryptjs';
import { applyLogoutCookie, applySessionCookie, login, logout, requireAdmin } from '../auth.js';
import adminModel from '../../models/adminModel.js';
import auditService from '../../services/auditService.js';
import { clean, isStrongPassword } from '../../utils/validate.js';

const router = Router();

router.post('/login', async (req, res) => {
  const username = clean(req.body?.username, 64);
  const password = String(req.body?.password ?? '');

  if (!username || !password) {
    res.status(400).json({ ok: false, error: { code: 'invalid_input', message: 'Login va parolni kiriting' } });
    return;
  }

  const result = await login({
    username,
    password,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? '',
  });

  if (!result.ok) {
    res.status(result.status ?? 401).json({ ok: false, error: { code: 'auth_failed', message: result.message } });
    return;
  }

  applySessionCookie(res, result.token, result.expiresAt);
  res.json({ ok: true, data: { admin: result.admin, expiresAt: result.expiresAt } });
});

router.post('/logout', (req, res) => {
  logout(req);
  applyLogoutCookie(res);
  res.json({ ok: true, data: { loggedOut: true } });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ ok: true, data: { admin: req.admin } });
});

/** Parolni almashtirish — barcha sessiyalar bekor qilinadi (xavfsizlik) */
router.post('/password', requireAdmin, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');

  const admin = adminModel.findById(req.admin.id);
  const passwordOk = admin ? await compare(currentPassword, admin.password_hash) : false;

  if (!passwordOk) {
    res.status(400).json({ ok: false, error: { code: 'invalid_password', message: 'Joriy parol noto‘g‘ri' } });
    return;
  }
  if (!isStrongPassword(newPassword)) {
    res.status(400).json({
      ok: false,
      error: { code: 'weak_password', message: 'Yangi parol kamida 8 belgi, harf va raqamdan iborat bo‘lsin' },
    });
    return;
  }

  adminModel.setPassword(admin.id, hashSync(newPassword, 12));
  adminModel.deleteSessionsForAdmin(admin.id);
  auditService.log({
    actor: req.admin.username,
    action: 'password_changed',
    entity: 'admin',
    entityId: admin.id,
    ip: req.ip,
  });

  applyLogoutCookie(res);
  res.json({ ok: true, data: { changed: true, message: 'Parol o‘zgartirildi. Qaytadan kiring.' } });
});

export default router;
