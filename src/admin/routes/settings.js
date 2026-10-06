/**
 * Sozlamalar (do'kon ma'lumotlari, yetkazish narxi) va administratorlar API'si.
 */
import { Router } from 'express';
import { hashSync } from 'bcryptjs';
import settingsModel from '../../models/settingsModel.js';
import adminModel from '../../models/adminModel.js';
import auditService from '../../services/auditService.js';
import { DEFAULT_SETTINGS } from '../../config/constants.js';
import { requireRole } from '../auth.js';
import { clean, isStrongPassword, isValidUsername, toIntOrNull } from '../../utils/validate.js';

const router = Router();

const EDITABLE_KEYS = Object.keys(DEFAULT_SETTINGS);
const NUMERIC_KEYS = new Set(['delivery_fee', 'free_delivery_threshold', 'low_stock_threshold']);

router.get('/', (_req, res) => {
  res.json({ ok: true, data: settingsModel.all() });
});

router.put('/', (req, res) => {
  const payload = req.body ?? {};
  const values = {};
  const errors = [];

  for (const [key, rawValue] of Object.entries(payload)) {
    if (!EDITABLE_KEYS.includes(key)) continue;

    if (NUMERIC_KEYS.has(key)) {
      const parsed = toIntOrNull(rawValue);
      if (parsed === null || parsed < 0) {
        errors.push(`${key} uchun musbat son kiriting`);
        continue;
      }
      values[key] = String(parsed);
    } else {
      const text = clean(rawValue, 300);
      if (key === 'shop_map_url' && text && !/^https?:\/\//.test(text)) {
        errors.push('Xarita havolasi http(s) bilan boshlanishi kerak');
        continue;
      }
      values[key] = text;
    }
  }

  if (errors.length) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: errors.join('. ') } });
    return;
  }
  if (Object.keys(values).length === 0) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'O‘zgartirish uchun maydon yo‘q' } });
    return;
  }

  const updated = settingsModel.setMany(values);
  auditService.log({ actor: req.admin.username, action: 'settings_updated', details: values, ip: req.ip });
  res.json({ ok: true, data: updated });
});

// --- Administratorlar ---
router.get('/admins', requireRole('superadmin', 'admin'), (_req, res) => {
  const admins = adminModel.list().map(({ password_hash: _hash, ...rest }) => rest);
  res.json({ ok: true, data: { items: admins } });
});

router.post('/admins', requireRole('superadmin'), (req, res) => {
  const username = clean(req.body?.username, 32);
  const password = String(req.body?.password ?? '');
  const fullName = clean(req.body?.fullName, 80) || null;
  const role = ['admin', 'manager', 'superadmin'].includes(req.body?.role) ? req.body.role : 'admin';

  if (!isValidUsername(username)) {
    res.status(400).json({
      ok: false,
      error: { code: 'validation', message: 'Login 3-32 belgi: harflar, raqamlar, nuqta, _ yoki -' },
    });
    return;
  }
  if (!isStrongPassword(password)) {
    res.status(400).json({
      ok: false,
      error: { code: 'weak_password', message: 'Parol kamida 8 belgi, harf va raqamdan iborat bo‘lsin' },
    });
    return;
  }
  if (adminModel.findByUsername(username)) {
    res.status(409).json({ ok: false, error: { code: 'duplicate', message: 'Bu login band' } });
    return;
  }

  const admin = adminModel.create({ username, passwordHash: hashSync(password, 12), fullName, role });
  auditService.log({
    actor: req.admin.username,
    action: 'admin_created',
    entity: 'admin',
    entityId: admin.id,
    details: { username, role },
    ip: req.ip,
  });

  const { password_hash: _hash, ...safe } = admin;
  res.status(201).json({ ok: true, data: safe });
});

router.patch('/admins/:id', requireRole('superadmin', 'admin'), (req, res) => {
  const id = Number(req.params.id);
  const admin = adminModel.findById(id);
  if (!admin) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Administrator topilmadi' } });
    return;
  }

  // Faqat superadmin boshqa adminlarni o'chira oladi
  if (req.body?.isActive === false && req.admin.role !== 'superadmin') {
    res.status(403).json({ ok: false, error: { code: 'forbidden', message: 'Buni faqat superadmin qila oladi' } });
    return;
  }

  const updated = adminModel.update(id, {
    ...(req.body?.fullName !== undefined ? { fullName: clean(req.body.fullName, 80) } : {}),
    ...(req.body?.role !== undefined && req.admin.role === 'superadmin' ? { role: req.body.role } : {}),
    ...(req.body?.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
    ...(req.body?.telegramId !== undefined ? { telegramId: toIntOrNull(req.body.telegramId) } : {}),
  });

  if (req.body?.isActive === false) adminModel.deleteSessionsForAdmin(id);
  auditService.log({ actor: req.admin.username, action: 'admin_updated', entity: 'admin', entityId: id, ip: req.ip });

  const { password_hash: _hash, ...safe } = updated;
  res.json({ ok: true, data: safe });
});

router.delete('/admins/:id', requireRole('superadmin'), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.admin.id) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'O‘z akkauntingizni o‘chira olmaysiz' } });
    return;
  }
  if (id === 1) {
    res.status(400).json({ ok: false, error: { code: 'validation', message: 'Bosh administratorni o‘chirish mumkin emas' } });
    return;
  }

  const admin = adminModel.findById(id);
  if (!admin) {
    res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Administrator topilmadi' } });
    return;
  }

  adminModel.update(id, { isActive: false, telegramId: null });
  adminModel.deleteSessionsForAdmin(id);
  auditService.log({ actor: req.admin.username, action: 'admin_deactivated', entity: 'admin', entityId: id, ip: req.ip });
  res.json({ ok: true, data: { deactivated: true } });
});

export default router;
